/**
 * OKLCH → sRGB hex, and the duotone ramps derived from a beat's colour.
 *
 * The browser understands `oklch()` in CSS, but librsvg (inside sharp) does
 * not, and neither do ffmpeg's colour arguments. So anything that leaves the
 * browser — placeholder art, ffmpeg gradients, SVG filters — goes through
 * here. TypeScript rather than a script-local module, because the timeline
 * components need `duotoneRamp` too and the build scripts import this file
 * directly via Node's type stripping.
 */

export type Oklch = { l: number; c: number; h: number };

export function parseOklch(value: string): Oklch {
  const match = value.match(/oklch\(\s*([^)]+?)\s*\)/);
  if (!match) throw new Error(`Not an oklch() colour: ${value}`);
  const [l, c, h] = match[1].split(/\s+/).map(Number);
  return { l, c, h };
}

export function oklchToHex(l: number, c: number, h: number): string {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);

  // OKLab → LMS
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const lCube = l_ ** 3;
  const mCube = m_ ** 3;
  const sCube = s_ ** 3;

  // LMS → linear sRGB, gamma-encoded and clamped
  const encode = (channel: number) => {
    const v =
      channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.abs(channel) ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  };
  const toHex = (n: number) => n.toString(16).padStart(2, "0");

  return `#${toHex(encode(4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube))}${toHex(
    encode(-1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube),
  )}${toHex(encode(-0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube))}`;
}

export const hexFromOklch = (value: string): string => {
  const { l, c, h } = parseOklch(value);
  return oklchToHex(l, c, h);
};

/**
 * A duotone ramp for a colour: what a photo's shadows and highlights should
 * map to.
 *
 * Derived from the beat's own colour rather than a fixed rose, so the
 * background, the photographs and the video all shift together as the reader
 * scrolls — one system rather than three. Highlights are pulled toward the
 * colour and lightened, shadows are pushed down and slightly more saturated,
 * which is what gives a duotone its depth.
 */
export function duotoneRamp(value: string): { shadow: string; highlight: string } {
  const { l, c, h } = parseOklch(value);
  return {
    shadow: oklchToHex(Math.max(0.16, l - 0.32), c * 1.05, h),
    highlight: oklchToHex(Math.min(0.98, l + 0.11), c * 0.5, h),
  };
}

/**
 * Relative luminance, for verifying that text stays readable on a beat.
 *
 * Uses the WCAG formula. Kept here so the contrast check and the palette are
 * reading the same numbers.
 */
export function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(clean.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
