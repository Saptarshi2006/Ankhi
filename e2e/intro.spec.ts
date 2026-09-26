import { expect, test, type Page } from "@playwright/test";

/** Touch devices have no wheel to drive. */
const isCoarsePointer = (page: Page) =>
  page.evaluate(() => matchMedia("(pointer: coarse)").matches);

/**
 * Scroll the way a reader does.
 *
 * Touch devices drive the native scroll directly, since `mouse.wheel` throws
 * there. Lenis reconciles its internal position from the resulting scroll
 * event, so the scrubbed animations still follow.
 */
async function scrollBy(page: Page, total: number, steps = 14) {
  if (await isCoarsePointer(page)) {
    await page.evaluate((dy) => window.scrollBy(0, dy), total);
  } else {
    for (let i = 0; i < steps; i += 1) {
      await page.mouse.wheel(0, total / steps);
      await page.waitForTimeout(30);
    }
  }

  // Lenis eases toward the target rather than landing on it.
  await page.waitForTimeout(500);
}

const balloon = (page: Page) => page.locator('svg[viewBox="0 0 200 320"]');
const prompt = (page: Page) => page.getByText("Click or press any key");
const lines = (page: Page) => page.locator("[data-line]");

/**
 * The prompt fades rather than unmounting, so `toBeHidden()` would never pass —
 * Playwright's visibility check ignores opacity. Read the real thing instead.
 */
const promptOpacity = (page: Page) =>
  prompt(page).evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity));

const expectPromptShown = (page: Page) =>
  expect.poll(() => promptOpacity(page)).toBeGreaterThan(0.5);

const expectPromptGone = (page: Page) =>
  expect.poll(() => promptOpacity(page)).toBeLessThan(0.5);

const isLocked = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains("scroll-locked"));

/** Scroll until the balloon arms, and report where that happened. */
async function growUntilArmed(page: Page) {
  for (let i = 0; i < 14; i += 1) {
    if (await isLocked(page)) return;
    await scrollBy(page, 300, 4);
  }
}

/** Scroll on to the moment the two words are fully spread. */
async function scrollToSpread(page: Page) {
  for (let i = 0; i < 30; i += 1) {
    await scrollBy(page, 300, 4);
    const spread = await page.evaluate(() => {
      const title = document.querySelector("h1");
      if (!title || Number(getComputedStyle(title).opacity) < 0.99) return false;
      const words = [...title.querySelectorAll("span")];
      if (words.length < 2) return false;
      const [a, b] = words.map((w) => w.getBoundingClientRect());
      return b.left - a.left > window.innerWidth * 0.6;
    });
    if (spread) return;
  }
}

test.describe("the letter is real content", () => {
  test("survives JavaScript being disabled", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/");

    await expect(lines(page)).toHaveCount(12);
    await expect(page.getByText("you became a part of the way I see my world.")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Happy 19th/ })).toBeAttached();

    await context.close();
  });
});

test.describe("balloon intro", () => {
  test("grows on scroll, locks, pops on click, then reveals the letter", async ({ page }) => {
    await page.goto("/");
    const coarse = await isCoarsePointer(page);

    const shape = balloon(page);
    await expect(shape).toBeVisible();

    // Phase A — the balloon starts small...
    const small = (await shape.boundingBox())!.height;
    expect(small).toBeLessThan(200);

    // ...and grows as the reader scrolls.
    await scrollBy(page, 900);
    const grown = (await shape.boundingBox())!.height;
    expect(grown).toBeGreaterThan(small * 2);

    // Phase B — armed: the prompt is up and the lock is on.
    await growUntilArmed(page);
    await expectPromptShown(page);
    expect(await isLocked(page)).toBe(true);

    /*
     * Regression: the balloon must be on screen, held still, when the lock
     * lands. Ending growth at "bottom bottom" used to complete it at the exact
     * instant the sticky frame unpinned, so the balloon shot off the top of the
     * screen and the reader was left looking at blank space with a dead page.
     */
    const framed = await page.evaluate(() => {
      const rect = document.querySelector('svg[viewBox="0 0 200 320"]')!.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        vh: window.innerHeight,
        // The sticky frame must still be pinned, not sliding away.
        stickyTop: Math.round(
          document.querySelector(".sticky-viewport")!.getBoundingClientRect().top,
        ),
      };
    });
    expect(framed.stickyTop).toBe(0);
    expect(framed.top).toBeGreaterThan(-40);
    expect(framed.bottom).toBeLessThan(framed.vh + 40);
    // ...and genuinely large, or there is nothing to pop.
    expect(framed.height).toBeGreaterThan(framed.vh * 0.5);

    // Touch input is swallowed outright for the duration of the lock.
    const touchBlocked = await page.evaluate(() => {
      const event = new TouchEvent("touchmove", { cancelable: true });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(touchBlocked).toBe(true);

    if (!coarse) {
      // A real wheel gesture cannot move the page either — and note the lock
      // no longer sets `overflow: hidden`, so this is Lenis refusing input,
      // the touchmove guard, and a hidden scrollbar doing the work.
      const held = await page.evaluate(() => window.scrollY);
      await scrollBy(page, 2000, 8);
      expect(Math.abs((await page.evaluate(() => window.scrollY)) - held)).toBeLessThan(4);
    }

    // Phase C — a click anywhere on the stage pops it.
    const parked = await page.evaluate(() => window.scrollY);
    await page.locator(".sticky-viewport").first().click();
    await expectPromptGone(page);

    // ...the lock releases on its own, without dumping the reader at the top.
    await expect.poll(() => isLocked(page)).toBe(false);
    await page.waitForTimeout(400);
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - parked)).toBeLessThan(40);

    // Phase F — every line of the letter ends up readable. SplitText emits
    // divs, and hides them behind the line's own aria-label.
    await scrollBy(page, 6000, 40);
    await expect(lines(page)).toHaveCount(12);
    await expect(page.locator("[data-line] div").first()).toHaveCSS("opacity", "1", {
      timeout: 10_000,
    });
  });

  test("the spread words land inside the viewport, not past its edges", async ({ page }) => {
    await page.goto("/");
    await growUntilArmed(page);
    await page.locator(".sticky-viewport").first().click();
    await page.waitForTimeout(1500);

    await scrollToSpread(page);

    /*
     * Regression: the travel distance used to be derived from a width measured
     * while the heading was mid-scale, which threw both words off-screen.
     */
    const words = await page.evaluate(() => {
      const spans = [...document.querySelectorAll("h1 span")].map((el) => {
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right) };
      });
      return { spans, vw: window.innerWidth };
    });

    expect(words.spans).toHaveLength(2);
    expect(words.spans[0].left).toBeGreaterThanOrEqual(0);
    expect(words.spans[1].right).toBeLessThanOrEqual(words.vw);
  });

  test("pops on a keypress", async ({ page }) => {
    await page.goto("/");
    await growUntilArmed(page);
    await expectPromptShown(page);

    await page.keyboard.press("Enter");
    await expectPromptGone(page);
  });

  test("the mute toggle does not pop the balloon", async ({ page }) => {
    await page.goto("/");
    await growUntilArmed(page);
    await expectPromptShown(page);

    // The stage treats any click as "pop"; the toggle has to opt out.
    await page.getByRole("button", { name: /Mute sound/ }).click();

    await expectPromptShown(page);
    await expect(page.getByRole("button", { name: /Unmute sound/ })).toBeVisible();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("never locks the scroll and shows the letter outright", async ({ page }) => {
    await page.goto("/");

    await expect(lines(page)).toHaveCount(12);

    await scrollBy(page, 2000);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

    // The prompt is the marker for the locked state; it must never appear.
    await expectPromptGone(page);
    expect(await isLocked(page)).toBe(false);
  });
});
