// Geometry of the parametric EQ graph: mapping between frequency/gain and
// canvas coordinates, finding the band handle under the pointer, and the band
// values a drag or a scroll leads to.

export interface EqGraphViewport {
  width: number;
  height: number;
  min_gain: number;
  max_gain: number;
  min_freq: number;
  max_freq: number;
  padding_lr: number;
  padding_right: number;
  padding_tb: number;
}

export interface EqGraphPoint {
  x: number;
  y: number;
}

// Same limits as the band sliders.
export const BAND_GAIN_LIMIT_DB = 15;
export const BAND_Q_MIN = 0.1;
export const BAND_Q_MAX = 20;

// How far from a handle the pointer may be to grab it: a finger needs more room.
export const HANDLE_HIT_RADIUS_MOUSE = 10;
export const HANDLE_HIT_RADIUS_TOUCH = 22;

// Each scroll step over a handle multiplies or divides its Q by this.
export const Q_SCROLL_FACTOR = 1.1;

const GAIN_DECIMALS = 1;
const Q_DECIMALS = 2;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const roundTo = (value: number, decimals: number) => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};

const plotWidth = (viewport: EqGraphViewport) =>
  viewport.width - viewport.padding_lr - viewport.padding_right;

// The gain axis is symmetric around 0 dB.
const gainSpan = (viewport: EqGraphViewport) =>
  2 * Math.max(Math.abs(viewport.min_gain), Math.abs(viewport.max_gain));

export function freqToX(freq: number, viewport: EqGraphViewport): number {
  const logFreq = Math.log2(freq / viewport.min_freq);
  const logMax = Math.log2(viewport.max_freq / viewport.min_freq);
  return (logFreq / logMax) * plotWidth(viewport) + viewport.padding_lr;
}

export function xToFreq(x: number, viewport: EqGraphViewport): number {
  const logMax = Math.log2(viewport.max_freq / viewport.min_freq);
  const freq =
    viewport.min_freq *
    Math.pow(2, ((x - viewport.padding_lr) / plotWidth(viewport)) * logMax);
  return clamp(freq, viewport.min_freq, viewport.max_freq);
}

export function gainToY(gain: number, viewport: EqGraphViewport): number {
  return (
    viewport.height / 2 -
    (gain * (viewport.height - 2 * viewport.padding_tb)) / gainSpan(viewport)
  );
}

export function yToGain(y: number, viewport: EqGraphViewport): number {
  return (
    ((viewport.height / 2 - y) * gainSpan(viewport)) /
    (viewport.height - 2 * viewport.padding_tb)
  );
}

/** Index of the handle closest to the point within the radius, or -1. */
export function findHandleAt(
  handles: Array<EqGraphPoint | null>,
  point: EqGraphPoint,
  radius: number,
): number {
  let found = -1;
  let closest = radius;
  handles.forEach((handle, index) => {
    if (!handle) return;
    const distance = Math.hypot(handle.x - point.x, handle.y - point.y);
    if (distance <= closest) {
      found = index;
      closest = distance;
    }
  });
  return found;
}

/** Frequency and gain for a handle dragged to the point, rounded like the sliders. */
export function bandValuesAt(
  point: EqGraphPoint,
  viewport: EqGraphViewport,
): { frequency: number; gain: number } {
  return {
    frequency: Math.round(xToFreq(point.x, viewport)),
    gain: roundTo(
      clamp(
        yToGain(point.y, viewport),
        -BAND_GAIN_LIMIT_DB,
        BAND_GAIN_LIMIT_DB,
      ),
      GAIN_DECIMALS,
    ),
  };
}

/** Q after one scroll step: scrolling up narrows the band, down widens it. */
export function scrollQ(q: number, deltaY: number): number {
  const factor = deltaY < 0 ? Q_SCROLL_FACTOR : 1 / Q_SCROLL_FACTOR;
  return roundTo(clamp(q * factor, BAND_Q_MIN, BAND_Q_MAX), Q_DECIMALS);
}
