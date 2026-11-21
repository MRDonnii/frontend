// Frequency response of the parametric EQ's bands, computed from the same RBJ
// Audio EQ Cookbook biquads the server builds for them
// (music_assistant/helpers/dsp.py), so the graph shows what is played.
// https://webaudio.github.io/Audio-EQ-Cookbook/audio-eq-cookbook.html
import {
  ParametricEQBandType,
  type ParametricEQBand,
} from "@/plugins/api/interfaces";

// The server designs the filters for the stream's sample rate, which the
// editor does not know. The rate only changes the curve close to Nyquist.
export const GRAPH_SAMPLE_RATE = 48000;

// Lowest gain reported, so a notch's exact centre stays a finite number.
export const RESPONSE_FLOOR_DB = -120;

export interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a0: number;
  a1: number;
  a2: number;
}

type BandShape = Pick<ParametricEQBand, "type" | "frequency" | "gain" | "q">;

/** The biquad the server builds for a band, with the same formulas. */
export function bandCoefficients(
  band: BandShape,
  sampleRate: number = GRAPH_SAMPLE_RATE,
): BiquadCoefficients {
  const a = Math.sqrt(Math.pow(10, band.gain / 20));
  const w0 = (2 * Math.PI * band.frequency) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * band.q);
  const shelfAlpha = 2 * Math.sqrt(a) * alpha;

  switch (band.type) {
    case ParametricEQBandType.LOW_SHELF:
      return {
        b0: a * (a + 1 - (a - 1) * cos + shelfAlpha),
        b1: 2 * a * (a - 1 - (a + 1) * cos),
        b2: a * (a + 1 - (a - 1) * cos - shelfAlpha),
        a0: a + 1 + (a - 1) * cos + shelfAlpha,
        a1: -2 * (a - 1 + (a + 1) * cos),
        a2: a + 1 + (a - 1) * cos - shelfAlpha,
      };
    case ParametricEQBandType.HIGH_SHELF:
      return {
        b0: a * (a + 1 + (a - 1) * cos + shelfAlpha),
        b1: -2 * a * (a - 1 + (a + 1) * cos),
        b2: a * (a + 1 + (a - 1) * cos - shelfAlpha),
        a0: a + 1 - (a - 1) * cos + shelfAlpha,
        a1: 2 * (a - 1 - (a + 1) * cos),
        a2: a + 1 - (a - 1) * cos - shelfAlpha,
      };
    case ParametricEQBandType.HIGH_PASS:
      return {
        b0: (1 + cos) / 2,
        b1: -(1 + cos),
        b2: (1 + cos) / 2,
        a0: 1 + alpha,
        a1: -2 * cos,
        a2: 1 - alpha,
      };
    case ParametricEQBandType.LOW_PASS:
      return {
        b0: (1 - cos) / 2,
        b1: 1 - cos,
        b2: (1 - cos) / 2,
        a0: 1 + alpha,
        a1: -2 * cos,
        a2: 1 - alpha,
      };
    case ParametricEQBandType.NOTCH:
      return {
        b0: 1,
        b1: -2 * cos,
        b2: 1,
        a0: 1 + alpha,
        a1: -2 * cos,
        a2: 1 - alpha,
      };
    case ParametricEQBandType.PEAK:
    default:
      return {
        b0: 1 + alpha * a,
        b1: -2 * cos,
        b2: 1 - alpha * a,
        a0: 1 + alpha / a,
        a1: -2 * cos,
        a2: 1 - alpha / a,
      };
  }
}

/** Gain in dB of a biquad at one frequency. */
export function biquadGainDb(
  c: BiquadCoefficients,
  frequency: number,
  sampleRate: number = GRAPH_SAMPLE_RATE,
): number {
  const w = (2 * Math.PI * frequency) / sampleRate;
  const cos1 = Math.cos(w);
  const sin1 = Math.sin(w);
  const cos2 = Math.cos(2 * w);
  const sin2 = Math.sin(2 * w);
  const numRe = c.b0 + c.b1 * cos1 + c.b2 * cos2;
  const numIm = c.b1 * sin1 + c.b2 * sin2;
  const denRe = c.a0 + c.a1 * cos1 + c.a2 * cos2;
  const denIm = c.a1 * sin1 + c.a2 * sin2;
  const power =
    (numRe * numRe + numIm * numIm) / (denRe * denRe + denIm * denIm);
  return Math.max(RESPONSE_FLOOR_DB, 10 * Math.log10(power));
}

/** Gain in dB of one band at each of the given frequencies. */
export function bandResponseDb(
  band: BandShape,
  frequencies: ArrayLike<number>,
  sampleRate: number = GRAPH_SAMPLE_RATE,
): Float32Array {
  const coefficients = bandCoefficients(band, sampleRate);
  const response = new Float32Array(frequencies.length);
  for (let i = 0; i < frequencies.length; i++) {
    response[i] = biquadGainDb(coefficients, frequencies[i], sampleRate);
  }
  return response;
}
