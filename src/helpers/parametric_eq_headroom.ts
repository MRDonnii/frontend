// Highest level of the parametric EQ's total response, and the preamp that
// keeps it at or below 0 dB so the EQ's boosts cannot clip.
import {
  AudioChannel,
  type ParametricEQFilter,
} from "@/plugins/api/interfaces";
import { bandResponseDb } from "./parametric_eq_response";

const SEARCH_MIN_FREQUENCY = 20;
const SEARCH_MAX_FREQUENCY = 20000;
const SEARCH_POINTS = 480;
const PREAMP_DECIMALS = 1;

const OUTPUT_CHANNELS = [AudioChannel.FL, AudioChannel.FR];

// Log-spaced across the audible range, plus every band's own frequency so the
// top of a narrow peak is not missed between two points.
function searchFrequencies(eq: ParametricEQFilter): number[] {
  const ratio = SEARCH_MAX_FREQUENCY / SEARCH_MIN_FREQUENCY;
  const frequencies = Array.from(
    { length: SEARCH_POINTS },
    (_, i) => SEARCH_MIN_FREQUENCY * Math.pow(ratio, i / (SEARCH_POINTS - 1)),
  );
  for (const band of eq.bands) {
    if (
      band.frequency > SEARCH_MIN_FREQUENCY &&
      band.frequency < SEARCH_MAX_FREQUENCY
    ) {
      frequencies.push(band.frequency);
    }
  }
  return frequencies;
}

/**
 * Highest gain in dB of the EQ on either output channel: enabled bands for
 * that channel, its own preamp, and, unless left out, the shared preamp.
 */
export function eqPeakGainDb(
  eq: ParametricEQFilter,
  { includeSharedPreamp = true } = {},
): number {
  const frequencies = searchFrequencies(eq);
  const shared = includeSharedPreamp ? (eq.preamp ?? 0) : 0;
  let peak = -Infinity;
  for (const channel of OUTPUT_CHANNELS) {
    const total = new Float64Array(frequencies.length).fill(
      shared + (eq.per_channel_preamp[channel] ?? 0),
    );
    for (const band of eq.bands) {
      if (!band.enabled) continue;
      if (band.channel !== AudioChannel.ALL && band.channel !== channel) {
        continue;
      }
      const response = bandResponseDb(band, frequencies);
      for (let i = 0; i < total.length; i++) total[i] += response[i];
    }
    for (const value of total) peak = Math.max(peak, value);
  }
  return peak;
}

/**
 * The shared preamp that brings the EQ's highest point to 0 dB, rounded down
 * so the result never ends up above 0 dB. An EQ that only cuts gets 0.
 */
export function autoPreampDb(eq: ParametricEQFilter): number {
  const peak = eqPeakGainDb(eq, { includeSharedPreamp: false });
  if (peak <= 0) return 0;
  const factor = Math.pow(10, PREAMP_DECIMALS);
  return -Math.ceil(peak * factor) / factor;
}
