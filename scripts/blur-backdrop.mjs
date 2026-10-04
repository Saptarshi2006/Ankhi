/**
 * The blurred backdrop that sits behind a full-bleed image or a portrait clip.
 *
 * Shared by `encode-videos.mjs` and `optimize-images.mjs` so the two cannot
 * drift apart. It used to live only in the video encoder, which is why the
 * intro's photograph never got one: it is a photograph, not a clip, so nothing
 * had ever looked at it.
 *
 * Why a file and not a CSS `filter: blur()` on a second copy of the image: a
 * full-viewport blur is recomputed by the compositor for as long as it is on
 * screen, and on a phone that is the one effect on this site that costs frames
 * outright. Pre-blurring it means the backdrop costs nothing to paint. This is
 * the same trade as the media pipeline's poster frames — the expensive thing is
 * done once, at build time, instead of on every reader's device.
 *
 * The chain, in order, and each step earns its place:
 *
 *   scale 1.6× then crop   — enlarges before blurring so the softness has
 *                            something to work with; cropping back afterwards
 *                            means the output is still the source's framing,
 *                            just softer, so it cannot misalign with the sharp
 *                            image sitting on top of it
 *   gblur sigma 22         — a heavy blur, because it is only ever seen at
 *                            110% behind another image, where any hint of
 *                            detail reads as a mistake
 *   eq                     — a touch of saturation and a small brightness dip,
 *                            so the backdrop reads as a colour field rather
 *                            than as a recognisable photograph competing with
 *                            the real one
 */
export const BACKDROP_FILTER =
  "scale=iw*1.6:ih*1.6,crop=iw/1.15:ih/1.15,gblur=sigma=22,eq=brightness=-0.06:saturation=1.3";

/** Slightly overscanned when displayed, so the blur has no visible edge. */
export const BACKDROP_SCALE = 1.1;

/** WebP quality for a backdrop. Lower than the hero — it is never in focus. */
export const BACKDROP_QUALITY = 72;