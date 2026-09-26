/**
 * OKLCH → sRGB hex.
 *
 * The browser understands `oklch()` in CSS, but librsvg (inside sharp) does
 * not, and neither do ffmpeg's colour arguments. So anything that leaves the
 * browser — placeholder art, ffmpeg gradients, SVG filters baked into build
 * output — goes through here.
 */

/** Parse an `oklch(L C H)` string into numbers. */
export function parseOklch(value) {
  const match = value.match(/oklch\(\s*([^)]+?)\s*\)/);
  if (!match) throw new Error(`Not an oklch() colour: ${value}`);
  const [l, c, h] = match[1].split(/\s+/).map(Number);
  return { l, c, h };
}

/** Convert OKLCH components to an `#rrggbb` string, gamma-encoded and clamped. */
export function oklchToHex(l, c, h) {
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

  // LMS → linear sRGB
  const encode = (channel) => {
    const v = channel <= 0.0031308 ? 12.92 * channel : 1.055 * Math.abs(channel) ** (1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  };

  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(encode(4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube))}${toHex(
    encode(-1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube),
  )}${toHex(encode(-0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube))}`;
}

export const hexFromOklch = (value) => {
  const { l, c, h } = parseOklch(value);
  return oklchToHex(l, c, h);
};

/**
 * A duotone ramp for a colour: what the shadows and highlights of a photo
 * should map to.
 *
 * Derived from the beat's own colour so the background, the photographs and
 * the video all shift together as the reader scrolls — one system, not three.
 * Highlights are pulled toward the colour and lightened, shadows are pushed
 * down and slightly more saturated, which is what gives a duotone its depth.
 */
export function duotoneRamp(value) {
  const { l, c, h } = parseOklch(value);
  return {
    shadow: oklchToHex(Math.max(0.16, l - 0.32), c * 1.05, h),
    highlight: oklchToHex(Math.min(0.98, l + 0.11), c * 0.5, h),
  };
}
