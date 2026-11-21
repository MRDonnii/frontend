// Reading and writing the filter lines of Equalizer APO / Room EQ Wizard / AutoEQ
// text files for the parametric EQ. Syntax reference:
// https://sourceforge.net/p/equalizerapo/wiki/Configuration%20reference/
import {
  ParametricEQBandType,
  type ParametricEQBand,
} from "@/plugins/api/interfaces";

// The server builds every band from the RBJ Audio EQ Cookbook with a centre
// frequency and Q, which is what APO calls LSC/HSC for shelves and HPQ/LPQ for
// cuts. Plain LS/HS take a corner frequency instead, and HP/LP a fixed Q.
const APO_FILTER_TYPES: Record<string, ParametricEQBandType> = {
  PK: ParametricEQBandType.PEAK,
  PEQ: ParametricEQBandType.PEAK,
  HP: ParametricEQBandType.HIGH_PASS,
  HPQ: ParametricEQBandType.HIGH_PASS,
  LP: ParametricEQBandType.LOW_PASS,
  LPQ: ParametricEQBandType.LOW_PASS,
  LS: ParametricEQBandType.LOW_SHELF,
  LSC: ParametricEQBandType.LOW_SHELF,
  HS: ParametricEQBandType.HIGH_SHELF,
  HSC: ParametricEQBandType.HIGH_SHELF,
  NO: ParametricEQBandType.NOTCH,
  // Not supported: BP, AP, MODAL, LS/HS with a dB slope, and anything that is
  // not a parametric filter.
};

const BAND_TYPE_TO_APO: Record<ParametricEQBandType, string> = {
  [ParametricEQBandType.PEAK]: "PK",
  [ParametricEQBandType.HIGH_PASS]: "HPQ",
  [ParametricEQBandType.LOW_PASS]: "LPQ",
  [ParametricEQBandType.LOW_SHELF]: "LSC",
  [ParametricEQBandType.HIGH_SHELF]: "HSC",
  [ParametricEQBandType.NOTCH]: "NO",
};

// APO's HP and LP have no Q parameter: they are Butterworth filters.
export const APO_FIXED_PASS_Q = Math.SQRT1_2;

// Band types that have no gain parameter, so APO writes them without one.
const TYPES_WITHOUT_GAIN = new Set([
  ParametricEQBandType.HIGH_PASS,
  ParametricEQBandType.LOW_PASS,
  ParametricEQBandType.NOTCH,
]);

const FIXED_Q_TYPES = new Set(["HP", "LP"]);

// A band as an APO file describes it: the channel comes from "Channel:" lines.
export type ApoFilter = Omit<ParametricEQBand, "channel">;

export const bandTypeHasGain = (type: ParametricEQBandType): boolean =>
  !TYPES_WITHOUT_GAIN.has(type);

// Bandwidth in octaves to Q, from https://sengpielaudio.com/calculator-bandwidth.htm
export function bandwidthToQ(bandwidth: number): number {
  return Math.sqrt(Math.pow(2, bandwidth)) / (Math.pow(2, bandwidth) - 1);
}

// Matches the REW / APO form with keywords and the short APO form without:
// - "Filter 1: ON PK Fc 29.15 Hz Gain -9.60 dB Q 1.007"
// - "Filter: ON PK 29.15 Hz -9.60 dB 1.007"
// - "Filter: ON HPQ Fc 30 Hz Q 0.7" and "Filter: ON NO Fc 50 Hz BW Oct 0.1"
// Cuts and notches have no gain; HP and LP have no Q either.
const FILTER_LINE =
  /^Filter(?:\s+\d+)?:\s+(ON|OFF)\s+(\w+)\s+(?:Fc\s+)?(\d+\.?\d*)\s*(?:Hz)?(?:\s+(?:Gain\s+)?(-?\d+\.?\d*)\s*dB)?(?:\s+(?:BW\s+Oct\s+(\d+\.?\d*)|(?:Q\s+)?(\d+\.?\d*)))?/;

/**
 * Parse one "Filter" line of an APO / REW / AutoEQ file. Returns null for a
 * line that cannot be represented as a band: an unsupported filter type, or a
 * required gain or Q that is missing.
 */
export function parseApoFilterLine(line: string): ApoFilter | null {
  const match = line.trim().match(FILTER_LINE);
  if (!match) return null;
  const [, state, apoType, frequency, gain, bandwidth, q] = match;
  const type = APO_FILTER_TYPES[apoType.toUpperCase()];
  if (type === undefined) return null;
  if (gain === undefined && bandTypeHasGain(type)) return null;

  let finalQ: number;
  if (bandwidth !== undefined) {
    finalQ = bandwidthToQ(parseFloat(bandwidth));
  } else if (q !== undefined) {
    finalQ = parseFloat(q);
  } else if (FIXED_Q_TYPES.has(apoType.toUpperCase())) {
    finalQ = APO_FIXED_PASS_Q;
  } else {
    return null;
  }

  return {
    enabled: state === "ON",
    type,
    frequency: parseFloat(frequency),
    gain: gain === undefined ? 0 : parseFloat(gain),
    q: finalQ,
  };
}

/** One band as an APO "Filter" line, in the form APO reads back as the same filter. */
export function formatApoFilterLine(filter: ApoFilter, index: number): string {
  const state = filter.enabled ? "ON" : "OFF";
  const gain = bandTypeHasGain(filter.type)
    ? ` Gain ${filter.gain.toFixed(2)} dB`
    : "";
  return `Filter ${index}: ${state} ${BAND_TYPE_TO_APO[filter.type]} Fc ${filter.frequency.toFixed(1)} Hz${gain} Q ${filter.q.toFixed(3)}`;
}
