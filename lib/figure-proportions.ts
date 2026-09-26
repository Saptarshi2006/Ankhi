/**
 * How a person is shaped at a given age.
 *
 * The whole trick is that head-to-height ratio is a real, published proportion
 * of human growth, and it changes enormously across childhood. A baby is
 * roughly a quarter head; an adult roughly a seventh. Rendered honestly, that
 * shift reads instantly as "growing up" without anyone needing a face — which
 * is why this is a figure and not a generated likeness.
 *
 * Values are keyframes at the six beat ages, linearly interpolated between, so
 * the figure is continuous as the reader scrolls rather than snapping between
 * six states.
 */

export type FigureShape = {
  /** Fraction of the column's height the figure fills. The growth. */
  occupancy: number;
  /** Head height as a fraction of total height. The proportion that does the work. */
  headRatio: number;
  /** Head width relative to head height. Infants are rounder. */
  headWidth: number;
  /** 0 = no neck at all, 1 = full. Emerges around age five. */
  neck: number;
  /** Shoulder width as a fraction of total height. */
  shoulder: number;
  /** Hip height as a fraction of total height, measured from the floor. */
  legRatio: number;
  /** Arm length as a fraction of total height. */
  armLength: number;
};

type Keyframe = FigureShape & { age: number };

/**
 * Real-ish growth, front to back.
 *
 * `occupancy` is not a biological measure — it is how much of the column the
 * figure takes up, and it is chosen so the silhouette visibly lengthens
 * across the scroll.
 *
 * `neck` is the detail worth keeping. A child drawn as a small adult reads
 * wrong immediately; the disappearance of the neck between four and six is
 * most of what makes a child look like a child.
 */
const KEYFRAMES: readonly Keyframe[] = [
  { age: 0, occupancy: 0.42, headRatio: 0.250, headWidth: 1.05, neck: 0, shoulder: 0.190, legRatio: 0.38, armLength: 0.30 },
  { age: 5, occupancy: 0.55, headRatio: 0.200, headWidth: 1.00, neck: 0.5, shoulder: 0.200, legRatio: 0.46, armLength: 0.36 },
  { age: 10, occupancy: 0.70, headRatio: 0.163, headWidth: 0.92, neck: 1, shoulder: 0.210, legRatio: 0.50, armLength: 0.40 },
  { age: 13, occupancy: 0.80, headRatio: 0.143, headWidth: 0.86, neck: 1, shoulder: 0.225, legRatio: 0.53, armLength: 0.44 },
  { age: 16, occupancy: 0.90, headRatio: 0.133, headWidth: 0.82, neck: 1, shoulder: 0.245, legRatio: 0.52, armLength: 0.47 },
  { age: 19, occupancy: 0.96, headRatio: 0.130, headWidth: 0.80, neck: 1, shoulder: 0.255, legRatio: 0.52, armLength: 0.48 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The figure's proportions at any age, interpolated between keyframes. */
export function figureAt(age: number): FigureShape {
  const clamped = Math.max(KEYFRAMES[0].age, Math.min(KEYFRAMES[KEYFRAMES.length - 1].age, age));

  let lower = KEYFRAMES[0];
  let upper = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i += 1) {
    if (clamped >= KEYFRAMES[i].age && clamped <= KEYFRAMES[i + 1].age) {
      lower = KEYFRAMES[i];
      upper = KEYFRAMES[i + 1];
      break;
    }
  }

  const span = upper.age - lower.age;
  const t = span === 0 ? 0 : (clamped - lower.age) / span;

  return {
    occupancy: lerp(lower.occupancy, upper.occupancy, t),
    headRatio: lerp(lower.headRatio, upper.headRatio, t),
    headWidth: lerp(lower.headWidth, upper.headWidth, t),
    neck: lerp(lower.neck, upper.neck, t),
    shoulder: lerp(lower.shoulder, upper.shoulder, t),
    legRatio: lerp(lower.legRatio, upper.legRatio, t),
    armLength: lerp(lower.armLength, upper.armLength, t),
  };
}

/**
 * Geometry in a 100 × 100 box, feet on the floor, y increasing downward.
 *
 * Returned as plain numbers so it can be written straight onto SVG attributes
 * from a scroll handler, without going through React's render cycle. That
 * matters: this updates on every frame of the scrub, and a re-render per frame
 * would be the difference between smooth and unusable.
 */
export function figureGeometry(shape: FigureShape) {
  const H = shape.occupancy * 100;
  const floor = 100;

  const headH = H * shape.headRatio;
  const headTop = floor - H;
  const headBottom = headTop + headH;
  const headHalfW = (headH * shape.headWidth) / 2;

  const hipY = floor - H * shape.legRatio;

  // Whatever height is left between the head and the hips is neck plus torso.
  // The neck takes a small slice of it, scaled by `shape.neck`.
  const spare = Math.max(0, hipY - headBottom);
  const neckLen = spare * 0.14 * shape.neck;
  const shoulderY = headBottom + neckLen;

  const shoulderHalfW = (H * shape.shoulder) / 2;
  const armLen = H * shape.armLength;
  const armX = shoulderHalfW * 0.92;
  const legX = shoulderHalfW * 0.42;

  return {
    H,
    headCx: 0,
    headCy: headTop + headH / 2,
    headRx: headHalfW,
    headRy: headH / 2,
    neckTop: headBottom,
    neckBottom: shoulderY,
    shoulderY,
    shoulderHalfW,
    hipY,
    armX,
    armLen,
    handY: shoulderY + armLen,
    legX,
    feetY: floor,
  };
}
