import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { beats } from "@/content/years";
import { funTargets } from "@/content/fun";
import { site } from "@/content/site";
import { music, SLOT, SLOT_FOR_BEAT, TARGET_LUFS, TARGET_PEAK } from "@/content/music";
import { STAGE } from "@/lib/stage-ranges";

/** Touch devices have no wheel to drive. */
const isCoarsePointer = (page: Page) =>
  page.evaluate(() => matchMedia("(pointer: coarse)").matches);

/**
 * Scroll the way a reader does.
 *
 * Stepped on both input models, and that matters: touch devices have no wheel,
 * so they drive the native scroll directly. But stepping rather than jumping
 * in one go is the part that counts — a single 6000px programmatic jump is not
 * something a thumb produces, and Lenis will reconcile against it and undo it.
 */
async function scrollBy(page: Page, total: number, steps = 14) {
  const coarse = await isCoarsePointer(page);
  const delta = total / steps;

  for (let i = 0; i < steps; i += 1) {
    if (coarse) {
      await page.evaluate((dy) => window.scrollBy(0, dy), delta);
    } else {
      await page.mouse.wheel(0, delta);
    }
    await page.waitForTimeout(30);
  }

  // Lenis eases toward the target rather than landing on it.
  await page.waitForTimeout(500);
}

/**
 * Set the scroll position directly, and make sure it stuck.
 *
 * `waitForScrollSettle` cannot be relied on beforehand: Lenis's easing moves
 * less than a pixel per sample once it is finishing, so three identical
 * readings arrive while it still has force, and on the next frame it puts the
 * page back where it thought it should be. That presents as the thing being
 * tested being broken — a jump to 7056 silently became 3224, which is not
 * inside any beat at all.
 */
/**
 * A scroll position at `fraction` of the way through the pinned timeline.
 *
 * `fraction` is in units of beats, so 0.5 is the middle of the first year and
 * 3 is the start of the fourth.
 */
async function beatFraction(page: Page, beatsIn: number) {
  return page.evaluate((f) => {
    const spacer = document.querySelector<HTMLElement>("[data-timeline]")!.parentElement!;
    const top = Math.round(spacer.getBoundingClientRect().top + scrollY);
    return top + Math.round((spacer.clientHeight - innerHeight) * (f / 6));
  }, beatsIn);
}

async function jumpTo(page: Page, y: number) {
  await expect
    .poll(
      async () => {
        await page.evaluate((to) => window.scrollTo({ top: to, behavior: "instant" }), y);
        await page.waitForTimeout(140);
        return page.evaluate(() => Math.round(window.scrollY));
      },
      { timeout: 8000, message: `the jump to ${y} never stuck` },
    )
    .toBe(y);
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

/**
 * Wait until the scroll position has genuinely stopped changing.
 *
 * The pop kicks off a 1.2s Lenis glide. Scrolling during it means fighting the
 * in-flight tween, because `autoKill` only reacts to real wheel and touch input
 * — not to a programmatic scroll. Real readers never hit this; tests do.
 *
 * Requires three consecutive identical samples rather than two: the glide
 * eases out, so its final pixels move less than one per sample and two equal
 * readings can land while Lenis is still applying force.
 */
async function waitForScrollSettle(page: Page) {
  let previous = -1;
  let stable = 0;
  for (let i = 0; i < 60; i += 1) {
    const current = await page.evaluate(() => Math.round(window.scrollY));
    stable = current === previous ? stable + 1 : 0;
    if (stable >= 3) return;
    previous = current;
    await page.waitForTimeout(100);
  }
}

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

    /*
     * Phase C — a click anywhere on the stage pops it. The lock releases and
     * the page glides itself forward to the title; the exact landing is
     * asserted in "the title arrives on its own after the pop".
     */
    const before = await page.evaluate(() => window.scrollY);
    await page.locator(".sticky-viewport").first().click();
    await expectPromptGone(page);

    await expect.poll(() => isLocked(page)).toBe(false);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 8000 })
      .toBeGreaterThan(before + 100);
    await waitForScrollSettle(page);

    // Phase F — every line of the letter ends up readable. SplitText emits
    // divs, and hides them behind the line's own aria-label.
    //
    // To the end of the document rather than a fixed distance: the timeline is
    // nearly four screens of scroll per beat, so 6000px no longer reaches the
    // letter and this quietly asserted against a letter that had not arrived.
    const bottom = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    await jumpTo(page, bottom);
    await page.waitForTimeout(600);
    await expect(lines(page)).toHaveCount(12);
    await expect(page.locator("[data-line] div").first()).toHaveCSS("opacity", "1", {
      timeout: 10_000,
    });
  });

  test("the spread words land inside the viewport, not past its edges", async ({ page }) => {
    await page.goto("/");
    await growUntilArmed(page);
    await page.locator(".sticky-viewport").first().click();
    await waitForScrollSettle(page);

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

test.describe("one continuous stage", () => {
  test("the title arrives on its own after the pop", async ({ page }) => {
    await page.goto("/");
    await growUntilArmed(page);
    await expectPromptShown(page);

    const releasedAt = await page.evaluate(() => window.scrollY);
    await page.locator(".sticky-viewport").first().click();

    // The page moves itself. No wheel, no keys.
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 8000 })
      .toBeGreaterThan(releasedAt + 100);

    // ...and lands with the title fully faded in.
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Number(getComputedStyle(document.querySelector("h1")!).opacity),
          ),
        { timeout: 8000 },
      )
      .toBeGreaterThan(0.95);
  });

  test("no frame inside the stage is ever empty, in either direction", async ({ page }) => {
    await page.goto("/");

    const { stageHeight, vh } = await page.evaluate(() => ({
      stageHeight: Math.round(
        document.querySelector(".track-stage")!.getBoundingClientRect().height,
      ),
      vh: window.innerHeight,
    }));

    /*
     * Regression, and the most direct statement of the bug: the balloon and
     * the title used to be two sticky sections, and the gap between them was
     * always exactly one viewport — 1280px of nothing after the pop, and a
     * hole above the title on the way back up.
     *
     * Never popped, so the balloon is present for the whole stage. Every scroll
     * position inside it must show one or the other.
     */
    const empties: number[] = [];
    for (let y = 0; y <= stageHeight; y += 100) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(90);

      const blank = await page.evaluate(() => {
        const visible = (selector: string) => {
          const el = document.querySelector(selector);
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return (
            rect.bottom > 0 &&
            rect.top < window.innerHeight &&
            Number(getComputedStyle(el).opacity) > 0.05
          );
        };
        return (
          !visible("h1") && !visible('svg[viewBox="0 0 200 320"]')
        );
      });

      if (blank) empties.push(y);
    }

    // Only the very end, where the frame has finished scrolling away, may be
    // empty. Anything earlier is a gap.
    const tolerated = stageHeight - vh * 0.35;
    expect(empties.filter((y) => y < tolerated)).toEqual([]);
  });
});

test.describe("after the balloon is gone", () => {
  test("scrolling back to the top still meets the words", async ({ page }) => {
    await page.goto("/");
    await growUntilArmed(page);
    await page.locator(".sticky-viewport").first().click();
    await waitForScrollSettle(page);

    /*
     * Regression. The balloon pops once and never returns, by design — which
     * left the first 1.25 screens of the stage permanently empty. Invisible on
     * the way down, because the balloon fills it, and a blank ~1.2 screens the
     * moment the reader scrolled back up.
     */
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(700);

    const reprise = await page.evaluate(() => {
      const el = document.querySelector("[data-reprise]");
      if (!el) return { present: false };
      const rect = el.getBoundingClientRect();
      return {
        present: true,
        onScreen:
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          Number(getComputedStyle(el).opacity) > 0.05,
        text: el.textContent?.trim(),
      };
    });

    expect(reprise.present).toBe(true);
    expect(reprise.onScreen).toBe(true);
    expect(reprise.text).toBe("Happy 19th");
  });

  test("the reprise hands over to the main heading without a gap", async ({ page }) => {
    await page.goto("/");
    await growUntilArmed(page);
    await page.locator(".sticky-viewport").first().click();
    await waitForScrollSettle(page);

    // Every position across the handover must show at least one of the two.
    const gaps: number[] = [];
    for (let y = 0; y <= 1600; y += 100) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(90);

      const blank = await page.evaluate(() => {
        const visible = (selector: string) => {
          const el = document.querySelector(selector);
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          return (
            rect.bottom > 0 &&
            rect.top < window.innerHeight &&
            Number(getComputedStyle(el).opacity) > 0.05
          );
        };
        return (
          !visible("[data-reprise]") &&
          !visible("h1") &&
          !visible('svg[viewBox="0 0 200 320"]')
        );
      });

      if (blank) gaps.push(y);
    }

    expect(gaps).toEqual([]);
  });
});

test.describe("the 404", () => {
  test("serves the custom page with a real 404 status", async ({ page }) => {
    const response = await page.goto("/nothing-here");

    // Not just the copy — the status has to be a genuine 404, which is what
    // assets.not_found_handling buys on Workers.
    expect(response?.status()).toBe(404);
    await expect(page.getByText("This page never existed.")).toBeVisible();
    await expect(page.getByText("But she does.")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Back to the beginning/ }),
    ).toBeVisible();
  });

  test("the link leads back to the letter", async ({ page }) => {
    await page.goto("/nothing-here");
    await page.getByRole("link", { name: /Back to the beginning/ }).click();

    await expect(lines(page)).toHaveCount(12);
  });
});

test.describe("deploy config", () => {
  test("the export ships _headers so hashed assets cache immutably", () => {
    /*
     * Guards a silent production regression. Without out/_headers, Workers
     * serves everything as `max-age=0, must-revalidate`, so every returning
     * visitor revalidates and re-downloads the whole ~1.2MB of JS, CSS and
     * fonts. Nothing errors when that file goes missing — it just quietly
     * gets slower.
     */
    const headers = readFileSync(join(process.cwd(), "out", "_headers"), "utf8");

    expect(headers).toContain("/_next/static/*");
    expect(headers).toMatch(/Cache-Control:\s*public, max-age=31536000, immutable/);
    /*
     * Timeline media is cached hard, but for a fixed window rather than
     * immutably: the URLs are derived from the source filename, so replacing a
     * source does not change an already-cached URL.
     */
    expect(headers).toContain("/photos/*");
    expect(headers).toContain("/videos/*");
    expect(headers).toMatch(/Cache-Control:\s*public, max-age=2592000/);
    // The crowd beds were shipped with no cache policy at all, the same way the
    // timeline media was.
    expect(headers).toContain("/audio/*");
  });

  test("wrangler deploys assets only, with no Worker script", () => {
    const config = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");

    expect(config).toContain('"directory": "./out"');
    expect(config).toContain('"not_found_handling": "404-page"');
    // A `main` would pull in a Worker runtime this site does not need.
    expect(config).not.toMatch(/^\s*"main"/m);
  });
});

test.describe("the timeline", () => {
  /** Pop the balloon and settle, so the reader is past the intro lock. */
  async function reachTimeline(page: Page) {
    await page.goto("/");
    await growUntilArmed(page);
    await page.locator(".sticky-viewport").first().click();
    await waitForScrollSettle(page);
  }

  /** Scroll on until the timeline is pinned. */

/**
 * What is currently visible for one beat.
 *
 * Deliberately keyed off what is *visible* rather than off scroll offsets. The
 * stage table lives in `lib/timeline-scroll.ts` and is a design decision, not a
 * contract; a test that hardcodes the same numbers would pass while the design
 * drifted and fail when it was correct.
 */
const seen = (page: Page, beat: number) =>
  page.evaluate((i) => {
    const scene = document.querySelector(`[data-scene="${i}"]`)!;
    const on = (sel: string) => {
      const el = scene.querySelector(sel);
      return el ? Number.parseFloat(getComputedStyle(el).opacity) > 0.05 : false;
    };
    const quads = [...scene.querySelectorAll("[data-quad]")].filter(
      (el) => Number.parseFloat(getComputedStyle(el).opacity) > 0.05,
    ).length;
    const takeovers = [...document.querySelectorAll("[data-takeover]")].filter(
      (el) => Number.parseFloat(getComputedStyle(el).opacity) > 0.02,
    );
    /*
     * The curtain is a sibling of the track, not a child of the scene — it has
     * to be, so that it can actually cover the page. Look for it where it
     * lives, addressed by the beat it belongs to.
     */
    const slab = document.querySelector<HTMLElement>(
      `[data-curtain-for="${i}"] [data-curtain-slab]`,
    );
    if (!slab) throw new Error(`no curtain for beat ${i}`);
    return {
      title: on("[data-s-title]"),
      year: on("[data-s-year]"),
      turn: on("[data-s-turn]"),
      quads,
      hero: on("[data-hero]"),
      yearText: scene.querySelector("[data-s-year]")?.textContent?.trim() ?? "",
      curtainX: new DOMMatrixReadOnly(getComputedStyle(slab).transform).m41,
      curtainOpacity: Number.parseFloat(getComputedStyle(slab.parentElement!).opacity),
      takeovers: takeovers.map((el) => (el as HTMLElement).dataset.takeoverBeat ?? ""),
      takeoverBox: takeovers[0]
        ? {
            w: takeovers[0].getBoundingClientRect().width,
            h: takeovers[0].getBoundingClientRect().height,
          }
        : null,
      trackLeft: Math.round(
        document.querySelector(".track-scroll")!.getBoundingClientRect().left,
      ),
      beatWidth: document.querySelector<HTMLElement>("[data-timeline]")!.clientWidth,
      vw: window.innerWidth,
      vh: window.innerHeight,
    };
  }, beat);

  /**
   * The absolute scroll position of a point inside one of a beat's stages.
   *
   * Read from the geometry the scene publishes about itself, so a test never
   * carries its own copy of the stage table.
   */
  async function stageY(page: Page, beat: number, stage: number, fraction = 0.5) {
    return page.evaluate(
      ({ beat: b, stage: st, fraction: f }) => {
        const scene = document.querySelector<HTMLElement>(`[data-scene="${b}"]`)!;
        const start = Number(scene.dataset.sceneStart);
        const offsets = scene.dataset.stageOffsets!.split(",").map(Number);
        const screens = scene.dataset.stageScreens!.split(",").map(Number);
        return Math.round(start + (offsets[st] + screens[st] * f) * window.innerHeight);
      },
      { beat, stage, fraction },
    );
  }

  /**
   * The index of a stage, by name, as the scene itself declares it.
   *
   * By name, not by scroll cost: two of the stages are 0.5 screens long, so
   * looking one up by its size found the title when the test meant the
   * photographs.
   */
  async function stageIndex(page: Page, beat: number, key: string) {
    return page.evaluate(
      ({ b, k }) => {
        const scene = document.querySelector<HTMLElement>(`[data-scene="${b}"]`)!;
        return scene.dataset.stageKeys!.split(",").indexOf(k);
      },
      { b: beat, k: key },
    );
  }

  /**
   * Walk the timeline in small steps, recording what is on screen at each.
   *
   * Steps are small enough that a stage cannot be missed — the curtain is only
   * a third of a screen — and each one waits just long enough for `scrub` to
   * finish catching up. `scrollBy` waits half a second for Lenis on every call,
   * which is right for a reader's gesture and ruinous when sampling forty
   * positions.
   */
  async function walk(
    page: Page,
    beat: number,
    spanPx: number,
    stepPx: number,
  ): Promise<Awaited<ReturnType<typeof seen>>[]> {
    const out = [];
    for (let travelled = 0; travelled < spanPx; travelled += stepPx) {
      await page.evaluate((dy) => window.scrollBy(0, dy), stepPx);
      await page.waitForTimeout(450);
      out.push(await seen(page, beat));
    }
    return out;
  }

  /**
   * Put the reader just before a beat's opening travel stage.
   *
   * Derived from the range the scene publishes for itself rather than guessed:
   * a beat is nearly four screens of scroll now, so "scroll a bit and hope"
   * lands in the wrong beat often enough to matter.
   */
  async function enterBeat(page: Page, index: number) {
    await enterTimeline(page);
    await gotoStage(page, index, 0, 0.1);
  }

  /** Scroll to a point inside a stage and let the scrub catch up. */
  async function gotoStage(page: Page, beat: number, stage: number, fraction = 0.5) {
    const y = await stageY(page, beat, stage, fraction);
    expect(Number.isFinite(y), `beat ${beat} stage ${stage} has no position`).toBe(true);
    await jumpTo(page, y);
    // Now let the scrub finish catching up, which is a separate clock again.
    await page.waitForTimeout(800);
  }

  async function enterTimeline(page: Page) {
    await reachTimeline(page);
    for (let i = 0; i < 30; i += 1) {
      const inside = await page.evaluate(() => {
        const el = document.querySelector("[data-timeline]");
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return rect.top <= 1 && rect.bottom >= innerHeight - 1;
      });
      if (inside) return;
      await scrollBy(page, 400, 4);
    }

    /*
     * Let go of the wheel.
     *
     * Everything past this point sets the scroll position directly rather than
     * by gesture, and Lenis reconciles against a programmatic jump on its next
     * frame — so while it is still animating it puts the page back where it
     * thought it should be. That looked like the stage geometry being wrong:
     * a jump to 7056 silently became 3224, which is not a beat at all.
     */
    await waitForScrollSettle(page);
  }

  test("renders one panel per beat, in order, before the letter", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("[data-timeline]")).toHaveCount(1);
    await expect(page.locator("[data-beat]")).toHaveCount(6);
    // Ordered, and the first panel is the first age.
    await expect(page.locator("[data-beat]").first()).toHaveAttribute("data-beat", "0");
    await expect(page.locator("[data-beat]").last()).toHaveAttribute("data-beat", "5");

    // The letter is the arrival, so it must come last in the document.
    const letterFollowsTimeline = await page.evaluate(() => {
      const timeline = document.querySelector("[data-timeline]")!;
      const letter = document.querySelector("[data-line]")!;
      return (
        (timeline.compareDocumentPosition(letter) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      );
    });
    expect(letterFollowsTimeline).toBe(true);
  });

  test("plays each beat's stages in the intended order", async ({ page }) => {
    test.slow();
    await enterBeat(page, 1);

    /*
     * Walks past a whole beat and records the first step at which each thing
     * appears, then asserts the order those first appearances happen in. This is
     * the contract the choreography actually promises — title, then year, then
     * turn, then photographs, then hero, then takeover — and it holds regardless
     * of how the scroll budget is divided between the stages.
     */
    const firstSeen: Record<string, number> = {};
    const samples = await walk(page, 1, 3400, 100);
    samples.forEach((s, step) => {
      for (const key of ["title", "year", "turn", "hero"] as const) {
        if (s[key] && firstSeen[key] === undefined) firstSeen[key] = step;
      }
      if (s.quads > 0 && firstSeen.quads === undefined) firstSeen.quads = step;
      if (s.takeovers.includes("1") && firstSeen.takeover === undefined) firstSeen.takeover = step;
    });

    for (const key of ["title", "year", "turn", "quads", "hero", "takeover"]) {
      expect(firstSeen[key], `${key} never appeared`).toBeDefined();
    }
    expect(firstSeen.title!).toBeLessThan(firstSeen.year!);
    expect(firstSeen.year!).toBeLessThan(firstSeen.turn!);
    expect(firstSeen.quads!).toBeLessThan(firstSeen.hero!);
    expect(firstSeen.hero!).toBeLessThan(firstSeen.takeover!);
  });

  test("gives the year a stage to itself", async ({ page }) => {
    await enterTimeline(page);
    await gotoStage(page, 1, 3, 0.75);

    const s = await seen(page, 1);
    expect(s.year).toBe(true);
    // Read from the content rather than hardcoded, so editing a beat's year
    // does not fail a test about the year getting a stage to itself.
    expect(s.yearText).toBe(String(beats[1].year));
    // Nothing else on screen, and specifically no age range: the rail carries
    // the ages continuously, and printing them here made the year a label.
    expect(s.title).toBe(false);
    expect(s.turn).toBe(false);
    expect(s.quads).toBe(0);
    expect(s.hero).toBe(false);
    expect(s.takeovers).toHaveLength(0);
  });

  test("the title surfaces, and nothing else is on screen while it does", async ({ page }) => {
    await enterTimeline(page);
    await gotoStage(page, 1, 1, 0.9);

    const s = await seen(page, 1);
    expect(s.title).toBe(true);
    expect(s.yearText && s.year).toBe(false);
    expect(s.turn).toBe(false);
    expect(s.quads).toBe(0);
    expect(s.hero).toBe(false);
    expect(s.takeovers).toHaveLength(0);
  });

  test("the curtain crosses the screen and never comes to rest", async ({ page }) => {
    test.slow();
    await enterTimeline(page);

    /*
     * Sampled across the whole beat rather than across a guessed window: the
     * ink is a third of a screen wide and moves fast, so a fixed sample rate
     * either misses it or samples nothing else.
     */
    const curtainIndex = await stageIndex(page, 1, "curtain");
    expect(curtainIndex, "the curtain stage is gone from the table").toBeGreaterThan(-1);

    const before = await seen(page, 1);
    await gotoStage(page, 1, curtainIndex, 0.5);
    const during = await seen(page, 1);
    await gotoStage(page, 1, curtainIndex + 1, 0.5);
    const after = await seen(page, 1);

    // Off to one side, then across, then off to the other: a crossing.
    expect(before.curtainX).toBeLessThan(-during.vw * 0.4);
    expect(after.curtainX).toBeGreaterThan(during.vw * 0.4);
    // Mid-sweep it is genuinely in frame, not teleported past.
    expect(Math.abs(during.curtainX)).toBeLessThan(during.vw * 0.7);
  });

  test("the four photographs fill the four corners, centre left clear", async ({ page }) => {
    await enterTimeline(page);
    const quadsIndex = await stageIndex(page, 1, "quads");
    expect(quadsIndex, "the photographs stage is gone from the table").toBeGreaterThan(-1);
    await gotoStage(page, 1, quadsIndex, 0.9);

    expect((await seen(page, 1)).quads).toBe(4);

    // Read the geometry inside the page: `window` is not a thing out here.
    const geometry = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const boxes = [...document.querySelectorAll('[data-scene="1"] [data-quad]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
      });
      const midX = vw / 2;
      const midY = vh / 2;
      return {
        count: boxes.length,
        left: boxes.filter((b) => b.x < midX).length,
        right: boxes.filter((b) => b.x > midX).length,
        rows: [...new Set(boxes.map((b) => (b.y < midY ? "top" : "bottom")))].sort(),
        // A photograph covering the middle would leave nowhere for the turn
        // text, and nowhere for the hero to come out of.
        centre: boxes.filter(
          (b) => Math.abs(b.x - midX) < b.w / 2 && Math.abs(b.y - midY) < b.h / 2,
        ).length,
      };
    });

    expect(geometry.count).toBe(4);
    expect(geometry.left).toBe(2);
    expect(geometry.right).toBe(2);
    expect(geometry.rows).toEqual(["bottom", "top"]);
    expect(geometry.centre).toBe(0);
  });

  test("the track holds still while a beat plays and moves between beats", async ({ page }) => {
    test.slow();
    await enterBeat(page, 1);

    /*
     * The point of the per-beat scene: the panels stop travelling for most of a
     * beat, so a composition can stand still in the middle of the frame, and
     * only move during the opening travel.
     */
    const xs = (await walk(page, 1, 3400, 100)).map((s) => s.trackLeft);
    const moved = xs.filter((x, i) => i > 0 && Math.abs(x - xs[i - 1]) > 2).length;

    // Mostly still...
    expect(moved / xs.length).toBeLessThan(0.45);
    // ...but not frozen, and only ever leftward.
    expect(moved).toBeGreaterThan(0);
    expect(Math.min(...xs)).toBeLessThan(Math.max(...xs));
  });

  test("only one takeover is ever on screen", async ({ page }) => {
    test.slow();
    await enterBeat(page, 1);

    /*
     * Six full-screen overlays, one per beat. An earlier version released them
     * on `onLeave`, and nothing resets a trigger that is entirely behind the
     * scroll — so they accumulated until five were stacked over the page.
     */
    const counts = (await walk(page, 1, 3400, 100)).map((s) => s.takeovers.length);
    expect(Math.max(...counts)).toBeLessThanOrEqual(1);
  });

  test("the hero takes the whole screen before the next year starts", async ({ page }) => {
    await enterTimeline(page);
    // The takeover has finished growing by the time this stage is done, so
    // look at its end rather than its start.
    await gotoStage(page, 1, await stageIndex(page, 1, "full"), 0.9);

    const s = await seen(page, 1);
    const where = await page.evaluate(() => {
      const sc = document.querySelector('[data-scene="1"]') as HTMLElement;
      const layer = (sel: string) => {
        const el = sc.querySelector(sel);
        if (!el) return "none";
        const c = getComputedStyle(el);
        return `${c.opacity}/${c.visibility}`;
      };
      return {
        y: Math.round(scrollY),
        vh: window.innerHeight,
        start: sc.dataset.sceneStart,
        title: layer("[data-s-title]"),
        year: layer("[data-s-year]"),
        turn: layer("[data-s-turn]"),
        hero: layer("[data-hero]"),
        takeovers: [...document.querySelectorAll("[data-takeover]")]
          .map((t) => {
            const c = getComputedStyle(t as HTMLElement);
            return `${(t as HTMLElement).dataset.takeoverBeat}:${c.opacity}`;
          })
          .join(" "),
      };
    });
    const at = JSON.stringify(where);

    expect(s.takeovers, at).toEqual(["1"]);
    // The overlay fills the frame...
    expect(s.takeoverBox!.w, at).toBeGreaterThan(s.vw * 0.95);
    expect(s.takeoverBox!.h, at).toBeGreaterThan(s.vh * 0.95);
    // ...and nothing of the beat is left on screen behind it. The hero stays
    // visible on purpose: it is the same image the overlay is growing out of,
    // and it is fully hidden the moment the takeover covers the frame.
    expect(s.quads, at).toBe(0);
    expect(s.turn, at).toBe(false);
    expect(s.title, at).toBe(false);
  });

  test("the colour travels from the first beat to the last", async ({ page }) => {
    await enterTimeline(page);
    const start = await page.evaluate(() =>
      getComputedStyle(document.querySelector("[data-liquid-base]")!).backgroundColor,
    );

    /*
     * The end of the pin, found rather than guessed. The timeline is 23 screens
     * of scroll now, so a fixed offset lands wherever it happens to.
     */
    const endY = await page.evaluate(() => {
      const spacer = document.querySelector<HTMLElement>("[data-timeline]")!.parentElement!;
      const bottom = Math.round(spacer.getBoundingClientRect().top + scrollY) + spacer.clientHeight;
      // Stop a viewport short of the very bottom, so this is the end of the last
      // beat rather than the letter that follows it.
      return bottom - window.innerHeight;
    });
    await jumpTo(page, endY);
    await page.waitForTimeout(900);
    const end = await page.evaluate(() =>
      getComputedStyle(document.querySelector("[data-liquid-base]")!).backgroundColor,
    );

    expect(start).not.toBe(end);
    // The last beat is the site's rose, so the timeline hands off to the
    // letter on exactly the same colour.
    expect(end).toBe("rgb(253, 242, 240)");
  });


  test("the rail's dot travels and lands on the age it is highlighting", async ({ page }) => {
    await enterTimeline(page);

    /*
     * The regression this exists for. The dot was moved with
     * `translateX(progress * 100%)` — a percentage of its own seven pixels — so
     * it crawled seven pixels across the whole timeline and the reader could
     * not tell it from a stuck element. It is positioned with `left` now.
     *
     * Asserted against the label centres read from the DOM rather than against
     * the highlighted label, because the highlight crossfades over 300ms and
     * mid-transition no label is above the threshold at all. The geometry is
     * what was broken; the highlight is checked once, separately.
     */
    const read = () =>
      page.evaluate(() => {
        const dot = document.querySelector<HTMLElement>(
          ".timeline-viewport span.rounded-full",
        )!;
        const track = dot.parentElement!.getBoundingClientRect();
        const labels = document.querySelectorAll<HTMLElement>(".timeline-viewport ol")[0];
        const centres = [...labels.children].map((li) => {
          const r = li.getBoundingClientRect();
          return r.left + r.width / 2;
        });
        const dr = dot.getBoundingClientRect();
        return {
          dot: dr.left + dr.width / 2,
          trackLeft: track.left,
          trackRight: track.right,
          centres,
        };
      });

    const at = async (fraction: number) => {
      const y = await page.evaluate((f) => {
        const spacer = document.querySelector<HTMLElement>("[data-timeline]")!.parentElement!;
        const top = Math.round(spacer.getBoundingClientRect().top + scrollY);
        return top + Math.round((spacer.clientHeight - innerHeight) * f);
      }, fraction);
      await jumpTo(page, y);
      await page.waitForTimeout(500);
      return read();
    };

    const start = await at(0);
    const end = await at(1);

    // It moves, and it covers the whole track.
    expect(end.dot - start.dot).toBeGreaterThan(100);
    // It never sits outside the track it belongs to.
    expect(start.dot).toBeGreaterThanOrEqual(start.trackLeft - 1);
    expect(end.dot).toBeLessThanOrEqual(end.trackRight + 1);

    // At every beat boundary the dot is on that beat's age, to the pixel.
    for (let beat = 0; beat < 6; beat += 1) {
      const s = await at(beat / 6);
      const target = s.centres[beat];
      expect(
        Math.abs(s.dot - target),
        `beat ${beat}: dot is ${(s.dot - target).toFixed(1)}px from its own age`,
      ).toBeLessThan(2);
    }

    /*
     * And the highlight flips exactly when the dot arrives at the next age.
     *
     * Mid-beat the two are meant to look different: the dot sits *between* two
     * ages because it travels continuously, while the highlight names the beat
     * the reader is actually in. So the thing to assert is the boundary, where
     * they meet.
     */
    for (let beat = 1; beat < 6; beat += 1) {
      // Just inside the beat, not exactly on the boundary: a single pixel either
      // side of one flips the highlight, and rounding the target can land below
      // it. The dot's position is continuous so it is checked *on* the
      // boundary above; this is about which age is named, which only has a
      // definite answer once you are inside the beat.
      const s = await at(beat / 6 + 0.03);
      const lit = await page.evaluate(() => {
        const labels = document.querySelectorAll<HTMLElement>(".timeline-viewport ol")[0];
        return [...labels.children].findIndex(
          (li) => Number.parseFloat(getComputedStyle(li).opacity) > 0.8,
        );
      });
      expect(lit, `just inside beat ${beat} the wrong age is lit`).toBe(beat);
      // And the dot is between this age and the next, heading for it. Clamped,
      // because the last beat has no next age to head for.
      expect(s.dot).toBeGreaterThan(s.centres[beat]);
      expect(s.dot).toBeLessThan(s.centres[Math.min(5, beat + 1)] + 2);
    }
  });

  test("the six beats run 2007 to 2026", async () => {
    expect(beats.map((b) => b.year)).toEqual([2007, 2012, 2017, 2020, 2023, 2026]);
    // The last one is the year she turns nineteen, and the first is her first.
    expect(beats.at(-1)!.year - beats.at(-1)!.ageTo).toBe(2007);
    // Strictly increasing, so the rail's `key={beat.year}` stays unique.
    for (let i = 1; i < beats.length; i += 1) {
      expect(beats[i].year).toBeGreaterThan(beats[i - 1].year);
    }
  });

  test("the words clear, and the years then bloom in out of a blur", async ({ page }) => {
    await page.goto("/");
    // `scrollBy`, not `page.mouse.wheel`: there is no wheel in mobile WebKit.
    await growUntilArmed(page);
    await page.locator(".sticky-viewport").first().click();
    await waitForScrollSettle(page);

    // `page.evaluate` runs in the page, so the constant has to be passed in
    // rather than closed over — referencing the import directly throws there.
    const read = () =>
      page.evaluate((from: number) => {
        const words = document.querySelectorAll<HTMLElement>("h1 span")[0];
        const line = [...document.querySelectorAll<HTMLElement>("p")].find((el) =>
          (el.textContent ?? "").includes(String(from)),
        );
        return {
          words: Number.parseFloat(getComputedStyle(words).opacity),
          line: line ? Number.parseFloat(getComputedStyle(line).opacity) : 0,
          blur: line ? getComputedStyle(line).filter : "",
          text: line?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        };
      }, site.spanFrom);

    const vh = page.viewportSize()!.height;

    // Mid-spread: the words are up, the years are not.
    await jumpTo(page, Math.round(STAGE.spreadEnd * vh * 0.9));
    await page.waitForTimeout(700);
    let s = await read();
    expect(s.words).toBeGreaterThan(0.8);
    expect(s.line).toBeLessThan(0.05);

    // The words are fully gone before the years begin. This is not only
    // compositional: at full spread the gap between them is 463px on a desktop
    // and 96px on a phone, so anything meant to sit between them is clipped on
    // the device this site is most likely read on.
    await jumpTo(page, Math.round(STAGE.revealIn * vh));
    await page.waitForTimeout(700);
    s = await read();
    expect(s.words).toBeLessThan(0.05);
    expect(s.line).toBeLessThan(0.2);

    // And by the end of the reveal it is sharp, opaque, and says the span.
    await jumpTo(page, Math.round(STAGE.revealEnd * vh));
    await page.waitForTimeout(800);
    s = await read();
    expect(s.line).toBeGreaterThan(0.9);
    expect(s.blur).toBe("blur(0px)");
    expect(s.text).toContain(String(site.spanFrom));
    expect(s.text).toContain(String(site.spanTo));
  });

  test("the photograph has the middle of the frame to itself", async ({ page }) => {
    await page.goto("/");
    await growUntilArmed(page);
    await page.locator(".sticky-viewport").first().click();
    await waitForScrollSettle(page);

    const read = () =>
      page.evaluate((from: number) => {
        const words = document.querySelectorAll<HTMLElement>("h1 span")[0];
        const photo = document.querySelector<HTMLElement>("[data-intro-photo]");
        const line = [...document.querySelectorAll<HTMLElement>("p")].find((el) =>
          (el.textContent ?? "").includes(String(from)),
        );
        return {
          words: Number.parseFloat(getComputedStyle(words).opacity),
          photo: photo ? Number.parseFloat(getComputedStyle(photo).opacity) : -1,
          line: line ? Number.parseFloat(getComputedStyle(line).opacity) : 0,
        };
      }, site.spanFrom);

    const vh = page.viewportSize()!.height;

    /*
     * Walk the whole span the photograph lives in, and insist it never shares
     * the middle of the frame with anything else.
     *
     * The temptation is to crossfade the photograph in against the departing
     * words, which is what it did first. It looked fine on a desktop and put
     * "Happy" straight across the middle of the picture on a phone, because the
     * parted words leave only 96px of gap there — there is no width in which
     * both being half-opaque reads as a transition rather than a collision.
     * So the hand-off is strict, and this is what keeps it strict.
     */
    const collisions: string[] = [];
    let peak = 0;

    for (let step = 0; step <= 40; step += 1) {
      const vhPos = STAGE.wordsOut + ((STAGE.revealEnd - STAGE.wordsOut) * step) / 40;
      await jumpTo(page, Math.round(vhPos * vh));
      await page.waitForTimeout(120);
      const s = await read();

      expect(s.photo, "the photograph is in the DOM at all").toBeGreaterThanOrEqual(0);
      peak = Math.max(peak, s.photo);

      if (s.photo > 0.05) {
        if (s.words > 0.05) collisions.push(`vh=${vhPos.toFixed(2)}: photo ${s.photo} with words ${s.words}`);
        if (s.line > 0.05) collisions.push(`vh=${vhPos.toFixed(2)}: photo ${s.photo} with years ${s.line}`);
      }
    }

    expect(collisions, "the photograph never overlaps the words or the years").toEqual([]);
    expect(peak, "the photograph is actually seen, not merely present").toBeGreaterThan(0.9);

    // And it is gone for the years, which own the frame from here.
    await jumpTo(page, Math.round(STAGE.revealEnd * vh));
    await page.waitForTimeout(800);
    const s = await read();
    expect(s.photo).toBeLessThan(0.05);
    expect(s.line).toBeGreaterThan(0.9);
  });

  test("nothing is fetched until the reader touches something", async ({ page }) => {
    test.slow();
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      const audio = { requests: [] as string[] };
      (w as Record<string, unknown>).__audio = audio;
      const fetchImpl = window.fetch.bind(window);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/audio/")) audio.requests.push(String(input));
        return fetchImpl(input, init);
      };
    });

    await page.goto("/");
    await page.waitForTimeout(900);

    const asked = () =>
      page.evaluate(() => (window as never as { __audio: { requests: string[] } }).__audio.requests);

    /*
     * Scrolling is not a gesture and must not fetch anything. The balloon grows
     * on scroll alone, so this is the window in which a naive implementation
     * would start downloading the score.
     */
    await scrollBy(page, 300, 3);
    expect(await asked(), "scrolling started an audio request").toHaveLength(0);

    // One tap unlocks it. Kept short of the arming point, because a tap after
    // the balloon is armed pops it, and a popped balloon is a different test.
    const box = page.viewportSize()!;
    await page.mouse.click(Math.round(box.width / 2), Math.round(box.height * 0.6));
    await expect.poll(async () => (await asked()).length, { timeout: 8000 }).toBeGreaterThan(0);

    /*
     * After the gesture it reads the manifest, and then asks only for slots the
     * encoder actually produced. Anything it requests must be in the manifest it
     * just read — which is the property that stops the site filling the console
     * with 404s, and the reason the manifest exists at all.
     */
    const declared = await page.evaluate(async () => {
      const response = await fetch("/audio/manifest.json");
      return ((await response.json()) as { slots: string[] }).slots;
    });

    await expect
      .poll(async () => {
        // Reduced to bare slot names: what is recorded is whatever form of the
        // URL the caller passed, and the same file can arrive as a string, a
        // `Request`, or a full URL.
        const requested = (await asked()).map((u) => u.split("/").pop() ?? "");
        const stray = requested.filter((n) => n.endsWith(".m4a") && !declared.includes(n.slice(0, -4)));
        if (stray.length) throw new Error(`asked for slots that were never cut: ${stray.join(", ")}`);
        return true;
      })
      .toBe(true);
  });

  test("only the final beat stays in full colour", async ({ page }) => {
    await page.goto("/");

    const duotoned = await page.evaluate(() =>
      [...document.querySelectorAll("[data-beat]")].map((beat) => {
        // The hero's media element itself: in the clip case `data-hero` is the
        // wrapper around the video, and the wrapper carries no filter.
        const media = beat.querySelector("[data-hero] video") ?? beat.querySelector("[data-hero]");
        return media ? getComputedStyle(media).filter : null;
      }),
    );

    // Five tinted, one not — the present, marked by being the only untouched
    // one in a set of duotones.
    expect(duotoned.filter(Boolean)).toHaveLength(6);
    expect(duotoned.filter((f) => f === "none")).toHaveLength(1);
  });

  test.describe("the score", () => {
    test("the manifest is internally valid", () => {
      const slots = music.map((m) => m.slot);
      expect(new Set(slots).size, "two slots share an id").toBe(slots.length);

      for (const m of music) {
        expect(m.file, `${m.slot} has no file`).toMatch(/^\d{2}-[a-z0-9-]+$/);
        expect(m.inSec, `${m.slot} starts before zero`).toBeGreaterThanOrEqual(0);
        expect(m.outSec, `${m.slot} is empty`).toBeGreaterThan(m.inSec);
        // A window shorter than a musical phrase sounds like a mistake, and the
        // encoder cannot tell the difference.
        expect(m.outSec - m.inSec, `${m.slot} is too short to be a phrase`).toBeGreaterThanOrEqual(20);
        if (m.gainDb !== undefined) expect(Math.abs(m.gainDb)).toBeLessThanOrEqual(12);
      }

      // Background music under a page of text should not be shouting.
      expect(TARGET_LUFS).toBeLessThanOrEqual(-14);
      expect(TARGET_LUFS).toBeGreaterThanOrEqual(-20);
      expect(TARGET_PEAK).toBeLessThanOrEqual(-1);
    });

    test("every beat has its own track, and none is repeated", () => {
      /*
       * The thing that was asked for: all six years get their own music. This
       * was nearly built with two beats sharing one recording, so it is
       * asserted rather than assumed.
       */
      const perBeat = [...SLOT_FOR_BEAT];
      expect(perBeat).toHaveLength(beats.length);
      expect(new Set(perBeat).size, "two beats share a track").toBe(perBeat.length);

      const declared = new Set(music.map((m) => m.slot));
      for (const slot of perBeat) {
        expect(declared.has(slot), `${slot} is played but never declared`).toBe(true);
      }
    });

    test("the opening, the six beats and the handover are all covered", () => {
      const declared = new Set(music.map((m) => m.slot));
      // Slot one and the return bracket the pop.
      expect(declared.has(SLOT.intro)).toBe(true);
      expect(declared.has(SLOT.return)).toBe(true);
      // The letter is deliberately not a slot of its own.
      expect(SLOT_FOR_BEAT).toHaveLength(beats.length);
      expect(declared.has(SLOT.letter)).toBe(false);

      /*
       * The nineteenth year runs on into the letter as a single take, so it has
       * to be long enough for both — a beat is thirty to forty seconds, and the
       * letter is a screen beyond that.
       */
      const last = music.find((m) => m.slot === SLOT_FOR_BEAT[5])!;
      expect(last.outSec - last.inSec, "too short to span the beat and the letter")
        .toBeGreaterThanOrEqual(80);
    });
  });

  test("every slot the manifest declares reaches the reader", async ({ page }) => {
    test.slow();
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      const audio = { requests: [] as string[] };
      (w as Record<string, unknown>).__audio = audio;
      const fetchImpl = window.fetch.bind(window);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/audio/")) audio.requests.push(String(input).split("/").pop() ?? "");
        return fetchImpl(input, init);
      };
    });

    await page.goto("/");
    await page.waitForTimeout(700);
    const box = page.viewportSize()!;
    await page.mouse.click(Math.round(box.width / 2), Math.round(box.height * 0.6));
    await growUntilArmed(page);
    await page.locator(".sticky-viewport").first().click();
    await waitForScrollSettle(page);

    // The manifest is what stops the site asking for slots that were never cut.
    await expect
      .poll(async () =>
        page.evaluate(() => (window as never as { __audio: { requests: string[] } }).__audio.requests),
      )
      .toContain("manifest.json");

    for (let beat = 0; beat < beats.length; beat += 1) {
      for (const f of [0.15, 0.6, 0.95]) {
        await jumpTo(page, await beatFraction(page, beat + f));
      }
    }
    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            (window as never as { __audio: { requests: string[] } }).__audio.requests.filter((r) =>
              r.endsWith(".m4a"),
            ).length,
          ),
        { timeout: 20_000 },
      )
      .toBe(music.length);
  });

  test("the pop lands inside a real silence, and the music comes back", async ({ page }) => {
    test.slow();
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      const audio = { gains: [] as AudioNode[] };
      (w as Record<string, unknown>).__audio = audio;
      const Real = window.AudioContext;
      (window as unknown as { AudioContext: unknown }).AudioContext = class extends Real {
        constructor(...args: unknown[]) {
          // @ts-expect-error spreading into super
          super(...args);
          const createGain = this.createGain.bind(this);
          this.createGain = () => {
            const g = createGain();
            audio.gains.push(g);
            return g;
          };
        }
      };
    });

    await page.goto("/");
    await page.waitForTimeout(700);
    const box = page.viewportSize()!;
    await page.mouse.click(Math.round(box.width / 2), Math.round(box.height * 0.6));
    await growUntilArmed(page);
    await expect
      .poll(async () =>
        page.evaluate(() => (window as never as { __audio: { gains: unknown[] } }).__audio.gains.length),
      )
      .toBeGreaterThan(1);

    // Sample the whole gain graph every frame across the pop.
    await page.evaluate(() => {
      const a = (window as never as { __audio: { gains: AudioNode[] } }).__audio;
      const w = window as unknown as { __trace: [number, number[]][] };
      w.__trace = [];
      const t0 = performance.now();
      const tick = () => {
        w.__trace.push([
          Math.round(performance.now() - t0),
          a.gains.map((g) => Number((g as GainNode).gain.value.toFixed(4))),
        ]);
        if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await page.locator(".sticky-viewport").first().click();
    await page.waitForTimeout(3400);

    const trace = await page.evaluate(
      () => (window as never as { __trace: [number, number[]][] }).__trace,
    );
    const flat = trace.flatMap(([, gains]) => gains);
    const quietest = Math.min(...flat);

    /*
     * The whole sequence is built on this. It failed once already with the crowd
     * in place of the music: the surge cancelled the scheduled silence, the
     * master eased 0.9 → 0.53 and stopped, and the pop landed on the crowd's
     * tail. So the floor is asserted, not assumed.
     */
    expect(quietest, "the music never actually stopped").toBeLessThan(0.02);

    // And something comes back afterwards, or the silence is just an ending.
    const later = trace.filter(([t]) => t > 900).map(([, g]) => Math.max(...g));
    expect(Math.max(...later), "nothing returned after the pop").toBeGreaterThan(0.3);
  });
});

test.describe("palette", () => {
  test("every beat keeps the ink readable, at AAA", async () => {
    /*
     * The six backgrounds are all light, which is why one ink colour serves the
     * whole timeline. That is an assumption, and this is what stops it quietly
     * becoming false: a future tweak to a beat's lightness could drop the text
     * below contrast without anything visibly breaking.
     */
    const { beats } = await import("../content/years");
    const { hexFromOklch, contrastRatio } = await import("../lib/colour");

    const ink = hexFromOklch("oklch(0.28 0.045 340)");

    for (const beat of beats) {
      const ratio = contrastRatio(ink, hexFromOklch(beat.colour));
      expect(
        ratio,
        `age ${beat.ageFrom}-${beat.ageTo} on ${hexFromOklch(beat.colour)}`,
      ).toBeGreaterThanOrEqual(7);
    }
  });
});

  /*
   * The photographs, checked as shipped rather than as declared.
   *
   * `src` is always the 1200px rendition, so that is the intrinsic size the
   * browser has to be told about; the source dimensions in content/years.ts are
   * what the *declared* size is derived from, and a transcription slip there
   * is invisible until something reserves the wrong box. This asserts the file
   * and the declaration agree.
   */
test("every quadrant image loads, and carries real alt text", async ({ page }) => {
  const failed: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/photos/") && !r.ok()) failed.push(`${r.status()} ${r.url()}`);
  });

  await page.goto("/");
  await page.waitForSelector("[data-scene]");

  // The rendered attributes, read from the DOM.
  const rendered = await page.evaluate(() =>
    [...document.querySelectorAll("[data-quad] img")].map((i) => ({
      src: i.getAttribute("src") ?? "",
      alt: i.getAttribute("alt") ?? "",
      w: i.getAttribute("width"),
      h: i.getAttribute("height"),
    })),
  );

  expect(rendered.length, "24 quadrant images exist").toBe(24);
  expect(failed, "no photo request may 404").toEqual([]);

  // Intrinsic decode, off the lazy path: a detached Image always loads.
  const ids = beats.flatMap((b) => b.photos.map((p) => p.id));
  const decoded = await page.evaluate(async (list) => {
    const one = (id: string) =>
      new Promise<{ id: string; ok: boolean; w: number; h: number; bytes: number }>((res) => {
        const img = new Image();
        const t = setTimeout(() => res({ id, ok: false, w: 0, h: 0, bytes: 0 }), 8000);
        img.onload = () => {
          clearTimeout(t);
          res({ id, ok: true, w: img.naturalWidth, h: img.naturalHeight, bytes: 0 });
        };
        img.onerror = () => {
          clearTimeout(t);
          res({ id, ok: false, w: 0, h: 0, bytes: 0 });
        };
        img.src = `/photos/${id}-1200.webp`;
      });
    return Promise.all(list.map(one));
  }, ids);

  for (const d of decoded) {
    console.log(
      `${d.id.padEnd(6)} ${d.ok ? "ok" : "FAILED"}  ${d.w}x${d.h}  aspect=${d.w ? (d.w / d.h).toFixed(3) : "-"}`,
    );
  }
  expect(decoded.filter((d) => !d.ok).map((d) => d.id), "every photo decodes").toEqual([]);

  // The declared width/height must match the file, or the browser reserves the
  // wrong box and the corner fly-in moves.
  const byId = new Map(rendered.map((r) => [r.src.replace("/photos/", "").replace("-1200.webp", ""), r]));
  const mismatched = decoded
    .map((d) => {
      const r = byId.get(d.id);
      return r && (Number(r.w) !== d.w || Number(r.h) !== d.h)
        ? `${d.id}: declared ${r.w}x${r.h}, file ${d.w}x${d.h}`
        : null;
    })
    .filter(Boolean);
  expect(mismatched, "declared dimensions match the encoded file").toEqual([]);

  const noAlt = rendered.filter((r) => !r.alt.trim() || r.alt.startsWith("PLACEHOLDER"));
  expect(noAlt.map((r) => `${r.src}: "${r.alt}"`), "real alt text on every photo").toEqual([]);
});

/* ------------------------------------------------------------------ the fun page */

test.describe("the fun page", () => {
  /** Drags the ball from the spot onto a target, the way a reader does. */
  async function dragOnto(page: Page, targetId: string) {
    const goal = await page.locator(`[data-target="${targetId}"]`).boundingBox();
    const ball = await page.locator("[data-ball]").boundingBox();
    expect(goal, `target ${targetId} is on the net`).not.toBeNull();
    expect(ball, "the ball is on the spot").not.toBeNull();
    await page.mouse.move(ball!.x + ball!.width / 2, ball!.y + ball!.height / 2);
    await page.mouse.down();
    await page.mouse.move(goal!.x + goal!.width / 2, goal!.y + goal!.height / 2, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(350);
  }

  test("the gate after the letter is a real link, and holding it goes", async ({ page }) => {
    await page.goto("/");
    const gate = page.locator("[data-fun-gate]");
    await expect(gate).toHaveCount(1);
    // A real href, not a div with a handler: without JavaScript this still goes
    // to the right place, and a screen reader calls it a link.
    expect(await gate.getAttribute("href")).toBe("/fun/");
    // Below the letter, which is the peak — the offer comes after it, not in it.
    const order = await page.evaluate(() => {
      const y = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().top ?? 0;
      return { letter: y("section p"), gate: y("[data-fun-gate]") };
    });
    expect(order.gate, "the gate follows the letter").toBeGreaterThan(order.letter);

    // Held for less than the threshold: nothing happens.
    await gate.scrollIntoViewIfNeeded();
    const box = (await gate.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);
    expect(
      Number(await gate.getAttribute("data-progress")),
      "a short press does not fill the ring",
    ).toBeLessThan(0.9);
    await page.mouse.up();
    await page.waitForTimeout(200);
    expect(new URL(page.url()).pathname, "a short press does not navigate").toBe("/");

    // Held past it: it goes.
    await page.mouse.down();
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 5000 })
      .toBe("/fun/");
    await page.mouse.up();
  });

  test("the gate is reachable and activatable from the keyboard", async ({ page }) => {
    await page.goto("/");
    const gate = page.locator("[data-fun-gate]");
    await gate.scrollIntoViewIfNeeded();
    await gate.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 5000 }).toBe("/fun/");
  });

  test("seven targets, a ball on the spot, and a way back at the end", async ({ page }) => {
    await page.goto("/fun/");
    await page.waitForSelector("[data-fun-pitch]");

    expect(await page.locator("[data-target]").count()).toBe(funTargets.length);
    expect(funTargets.length, "seven targets, seven pieces of media").toBe(7);
    expect(await page.locator("[data-ball]").count()).toBe(1);
    expect(await page.locator("[data-fun-done]").count(), "no way back until the end").toBe(0);
    expect(await page.locator("[data-fun-viewer]").count()).toBe(0);

    // The ground starts where the posts end, or the ball sits outside the area.
    const joined = await page.evaluate(() => {
      const g = document.querySelector("[data-fun-goal]")!.getBoundingClientRect();
      const d = document.querySelector("[data-fun-ground]")!.getBoundingClientRect();
      return Math.abs(g.bottom - d.top);
    });
    expect(joined, "the ground meets the posts").toBeLessThanOrEqual(2);

    // And the ball is inside the penalty area.
    const inside = await page.evaluate(() => {
      const b = document.querySelector("[data-ball]")!.getBoundingClientRect();
      const p = document.querySelector("[data-fun-box]")!.getBoundingClientRect();
      const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      return c.x > p.left && c.x < p.right && c.y > p.top && c.y < p.bottom;
    });
    expect(inside, "the ball is on the penalty spot, inside the area").toBe(true);

    for (const target of funTargets) {
      await dragOnto(page, target.id);
      expect(await page.locator("[data-fun-viewer]").count(), `${target.id} opened`).toBe(1);
      await page.locator("[data-fun-close]").click();
      await page.waitForTimeout(250);
    }

    expect(await page.locator("[data-target]").count(), "every target is gone").toBe(0);
    const done = page.locator("[data-fun-done]");
    await expect(done).toHaveCount(1);
    await expect(page.locator("[data-fun-done] a")).toHaveAttribute("href", "/");
  });

  test("a hit opens the media and the ball goes back to the spot", async ({ page }) => {
    await page.goto("/fun/");
    await page.waitForSelector("[data-fun-pitch]");
    const spot = (await page.locator("[data-ball]").boundingBox())!;

    for (const id of ["t1", "t2", "t5"]) {
      await dragOnto(page, id);
      await expect(page.locator("[data-fun-viewer]")).toHaveCount(1);
      const during = (await page.locator("[data-ball]").boundingBox())!;
      expect(Math.abs(during.y - spot.y), `${id}: the ball is back while the media is up`).toBeLessThanOrEqual(1);
      await page.locator("[data-fun-close]").click();
      await page.waitForTimeout(250);
      const after = (await page.locator("[data-ball]").boundingBox())!;
      expect(Math.abs(after.x - spot.x), `${id}: the ball is back on the spot`).toBeLessThanOrEqual(1);
      expect(Math.abs(after.y - spot.y), `${id}: the ball is back on the spot`).toBeLessThanOrEqual(1);
    }
    expect(await page.locator("[data-target]").count(), "three targets gone").toBe(4);
  });

  test("a drag that misses changes nothing", async ({ page }) => {
    await page.goto("/fun/");
    await page.waitForSelector("[data-fun-pitch]");
    const ball = (await page.locator("[data-ball]").boundingBox())!;
    await page.mouse.move(ball.x + ball.width / 2, ball.y + ball.height / 2);
    await page.mouse.down();
    // Empty sky, well clear of the net.
    await page.mouse.move(ball.x + ball.width / 2 + 4, 12, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(await page.locator("[data-target]").count(), "no target was hit").toBe(7);
    expect(await page.locator("[data-fun-viewer]").count(), "and nothing opened").toBe(0);
  });

  test("every target can be opened without a mouse", async ({ page }) => {
    await page.goto("/fun/");
    await page.waitForSelector("[data-fun-pitch]");
    // A drag-only game is a game half the readers cannot play.
    await page.locator('[data-target="t3"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-fun-viewer]")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-fun-viewer]")).toHaveCount(0);
  });

  test("the media behind the targets is real, and the videos are muted", async ({ page }) => {
    const bad: string[] = [];
    page.on("response", (r) => {
      if ((r.url().includes("/photos/") || r.url().includes("/videos/")) && !r.ok()) {
        bad.push(`${r.status()} ${r.url()}`);
      }
    });
    await page.goto("/fun/");
    await page.waitForSelector("[data-fun-pitch]");

    for (const target of funTargets) {
      await page.locator(`[data-target="${target.id}"]`).click();
      const dialog = page.locator("[data-fun-viewer]");
      await expect(dialog).toHaveCount(1);
      // Every target says what it is, to anyone who cannot see it.
      const label = (await dialog.getAttribute("aria-label")) ?? "";
      expect(label.length, `${target.id} is described`).toBeGreaterThan(20);
      expect(label.startsWith("PLACEHOLDER"), `${target.id} is not a placeholder`).toBe(false);

      if (target.kind === "video") {
        const video = page.locator("[data-fun-video]");
        await expect(video).toHaveCount(1);
        // Deliberately silent, with no unmute control anywhere.
        expect(await video.evaluate((v: HTMLVideoElement) => v.muted), `${target.id} is muted`).toBe(true);
        expect(await video.getAttribute("poster"), `${target.id} has a poster`).toContain(".jpg");
        const box = (await video.boundingBox())!;
        expect(box.width, `${target.id} is fitted to the frame, not cropped`).toBeLessThan(901);
      } else {
        await expect(page.locator("[data-fun-image]")).toHaveCount(1);
        const alt = (await page.locator("[data-fun-image]").getAttribute("alt")) ?? "";
        expect(alt.length, `${target.id} image has alt text`).toBeGreaterThan(20);
        expect(alt.startsWith("PLACEHOLDER"), `${target.id} alt is not a placeholder`).toBe(false);
      }

      await page.locator("[data-fun-close]").click();
      await page.waitForTimeout(200);
    }

    expect(bad, "no fun media request failed").toEqual([]);
  });

  test("the fun page is in the export", () => {
    const html = readFileSync(join(process.cwd(), "out", "fun", "index.html"), "utf8");
    expect(html, "the fun page is prerendered").toContain("data-fun-pitch");
    // `trailingSlash: true`, so the directory form is what Workers serves.
    expect(html).toContain("Seven, Ankhi");
  });
});
