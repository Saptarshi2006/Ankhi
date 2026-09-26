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

const rootOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.style.overflow);

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
    expect(small).toBeLessThan(80);

    // ...and grows as the reader scrolls.
    await scrollBy(page, 900);
    const grown = (await shape.boundingBox())!.height;
    expect(grown).toBeGreaterThan(small * 2);

    // Phase B — armed: the prompt is up and the scroll is held.
    await expectPromptShown(page);
    await expect.poll(() => rootOverflow(page)).toBe("hidden");

    // Touch input is swallowed outright for the duration of the lock.
    const touchBlocked = await page.evaluate(() => {
      const event = new TouchEvent("touchmove", { cancelable: true });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(touchBlocked).toBe(true);

    if (!coarse) {
      // A real wheel gesture cannot move the page either. (On touch there is
      // no wheel, and the programmatic scroll above deliberately bypasses the
      // lock — which is precisely the gap the touchmove guard covers.)
      const held = await page.evaluate(() => window.scrollY);
      await scrollBy(page, 1200);
      const stillHeld = await page.evaluate(() => window.scrollY);
      expect(Math.abs(stillHeld - held)).toBeLessThan(4);
    }

    // Phase C — a click anywhere on the stage pops it.
    await page.locator(".sticky-viewport").first().click();
    await expectPromptGone(page);

    // ...and the lock releases on its own.
    await expect.poll(() => rootOverflow(page)).toBe("");

    // Phase F — every line of the letter ends up readable. SplitText emits
    // divs, and hides them behind the line's own aria-label.
    await scrollBy(page, 6000, 40);
    await expect(lines(page)).toHaveCount(12);
    await expect(page.locator("[data-line] div").first()).toHaveCSS("opacity", "1", {
      timeout: 10_000,
    });
  });

  test("pops on a keypress", async ({ page }) => {
    await page.goto("/");
    await scrollBy(page, 1400);
    await expectPromptShown(page);

    await page.keyboard.press("Enter");
    await expectPromptGone(page);
  });

  test("the mute toggle does not pop the balloon", async ({ page }) => {
    await page.goto("/");
    await scrollBy(page, 1400);
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
    expect(await rootOverflow(page)).toBe("");
  });
});
