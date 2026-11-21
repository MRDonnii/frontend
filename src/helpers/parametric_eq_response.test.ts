import { describe, expect, it } from "vitest";
import {
  AudioChannel,
  ParametricEQBandType,
  type ParametricEQBand,
} from "@/plugins/api/interfaces";
import {
  bandCoefficients,
  bandResponseDb,
  biquadGainDb,
  GRAPH_SAMPLE_RATE,
  RESPONSE_FLOOR_DB,
} from "./parametric_eq_response";

const band = (overrides: Partial<ParametricEQBand>): ParametricEQBand => ({
  frequency: 1000,
  q: 1,
  gain: 0,
  type: ParametricEQBandType.PEAK,
  enabled: true,
  channel: AudioChannel.ALL,
  ...overrides,
});

const gainAt = (b: ParametricEQBand, frequency: number) =>
  bandResponseDb(b, [frequency])[0];

describe("bandResponseDb", () => {
  it("puts a peak's full gain at its centre frequency", () => {
    const peak = band({ gain: 6, q: 1.4 });
    expect(gainAt(peak, 1000)).toBeCloseTo(6, 4);
    expect(gainAt(peak, 20)).toBeCloseTo(0, 1);
    expect(gainAt(peak, 20000)).toBeCloseTo(0, 1);
  });

  it("draws shelves with half their gain at the centre frequency", () => {
    const low = band({
      type: ParametricEQBandType.LOW_SHELF,
      frequency: 200,
      gain: 8,
      q: 0.7,
    });
    expect(gainAt(low, 20)).toBeCloseTo(8, 1);
    expect(gainAt(low, 200)).toBeCloseTo(4, 4);
    expect(gainAt(low, 10000)).toBeCloseTo(0, 1);

    const high = band({
      type: ParametricEQBandType.HIGH_SHELF,
      frequency: 5000,
      gain: -6,
      q: 0.7,
    });
    expect(gainAt(high, 20000)).toBeLessThan(-5);
    expect(gainAt(high, 5000)).toBeCloseTo(-3, 4);
    expect(gainAt(high, 50)).toBeCloseTo(0, 2);
  });

  it("uses a shelf's Q, which the server applies", () => {
    const shelf = (q: number) =>
      band({
        type: ParametricEQBandType.LOW_SHELF,
        frequency: 200,
        gain: 8,
        q,
      });
    // a high Q overshoots past the gain just below the centre frequency
    expect(gainAt(shelf(2), 120)).toBeGreaterThan(8);
    expect(gainAt(shelf(0.5), 120)).toBeLessThan(8);
    expect(gainAt(shelf(2), 100)).not.toBeCloseTo(gainAt(shelf(0.5), 100), 1);
  });

  it("puts a Butterworth cut 3 dB down at its frequency", () => {
    const hp = band({
      type: ParametricEQBandType.HIGH_PASS,
      frequency: 40,
      q: Math.SQRT1_2,
    });
    expect(gainAt(hp, 40)).toBeCloseTo(-3.01, 2);
    expect(gainAt(hp, 4000)).toBeCloseTo(0, 3);
    const lp = band({
      type: ParametricEQBandType.LOW_PASS,
      frequency: 12000,
      q: Math.SQRT1_2,
    });
    expect(gainAt(lp, 12000)).toBeCloseTo(-3.01, 2);
    expect(gainAt(lp, 100)).toBeCloseTo(0, 3);
  });

  it("shows a cut's resonance for a Q above 0.707", () => {
    const hp = band({
      type: ParametricEQBandType.HIGH_PASS,
      frequency: 40,
      q: 2,
    });
    expect(gainAt(hp, 40)).toBeCloseTo(20 * Math.log10(2), 2);
  });

  it("ignores the gain of cuts and notches, like the server", () => {
    const notch = band({
      type: ParametricEQBandType.NOTCH,
      frequency: 50,
      q: 10,
      gain: 9,
    });
    expect(gainAt(notch, 1000)).toBeCloseTo(0, 3);
    expect(gainAt(notch, 50)).toBeLessThan(-40);
  });

  it("keeps the notch's centre finite", () => {
    const notch = band({
      type: ParametricEQBandType.NOTCH,
      frequency: 1000,
      q: 5,
    });
    expect(gainAt(notch, 1000)).toBe(RESPONSE_FLOOR_DB);
  });

  it("returns one value per frequency", () => {
    const response = bandResponseDb(band({ gain: 3 }), [100, 1000, 10000]);
    expect(response).toHaveLength(3);
    expect(response[1]).toBeCloseTo(3, 4);
  });
});

describe("bandCoefficients", () => {
  it("is a pass-through for a peak without gain", () => {
    const c = bandCoefficients(band({ gain: 0 }));
    expect(c.b0 / c.a0).toBeCloseTo(1, 12);
    expect(biquadGainDb(c, 3000)).toBeCloseTo(0, 10);
  });

  it("designs for the given sample rate", () => {
    const b = band({ frequency: 18000, gain: 6, q: 2 });
    expect(biquadGainDb(bandCoefficients(b, 44100), 18000, 44100)).toBeCloseTo(
      6,
      4,
    );
    expect(GRAPH_SAMPLE_RATE).toBe(48000);
  });
});
