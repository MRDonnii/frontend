import { describe, expect, it } from "vitest";
import {
  AudioChannel,
  DSPFilterType,
  ParametricEQBandType,
  type ParametricEQBand,
  type ParametricEQFilter,
} from "@/plugins/api/interfaces";
import { autoPreampDb, eqPeakGainDb } from "./parametric_eq_headroom";

const band = (overrides: Partial<ParametricEQBand>): ParametricEQBand => ({
  frequency: 1000,
  q: 1,
  gain: 0,
  type: ParametricEQBandType.PEAK,
  enabled: true,
  channel: AudioChannel.ALL,
  ...overrides,
});

const eq = (
  bands: ParametricEQBand[],
  preamp = 0,
  perChannel: ParametricEQFilter["per_channel_preamp"] = {},
): ParametricEQFilter => ({
  type: DSPFilterType.PARAMETRIC_EQ,
  enabled: true,
  preamp,
  per_channel_preamp: perChannel,
  bands,
});

describe("eqPeakGainDb", () => {
  it("is the preamp for an EQ without bands", () => {
    expect(eqPeakGainDb(eq([]))).toBe(0);
    expect(eqPeakGainDb(eq([], -4))).toBe(-4);
  });

  it("finds the top of a narrow peak", () => {
    expect(
      eqPeakGainDb(eq([band({ frequency: 3170, gain: 6, q: 12 })])),
    ).toBeCloseTo(6, 3);
  });

  it("adds up overlapping boosts and the preamp", () => {
    const bands = [band({ gain: 3 }), band({ gain: 3 })];
    expect(eqPeakGainDb(eq(bands))).toBeCloseTo(6, 3);
    expect(eqPeakGainDb(eq(bands, -6))).toBeCloseTo(0, 3);
  });

  it("leaves out switched-off bands", () => {
    expect(eqPeakGainDb(eq([band({ gain: 9, enabled: false })]))).toBe(0);
  });

  it("takes the louder channel", () => {
    const peq = eq([band({ gain: 4, channel: AudioChannel.FL })], 0, {
      [AudioChannel.FR]: 2,
    });
    expect(eqPeakGainDb(peq)).toBeCloseTo(4, 3);
  });
});

describe("autoPreampDb", () => {
  it("lowers the preamp by the highest boost", () => {
    expect(autoPreampDb(eq([band({ gain: 6 })]))).toBe(-6);
  });

  it("ignores the preamp already set", () => {
    expect(autoPreampDb(eq([band({ gain: 6 })], -2))).toBe(-6);
  });

  it("rounds down, so the result never ends up above 0 dB", () => {
    const peq = eq([band({ gain: 5.03 })]);
    const preamp = autoPreampDb(peq);
    expect(preamp).toBe(-5.1);
    expect(eqPeakGainDb({ ...peq, preamp })).toBeLessThanOrEqual(0);
  });

  it("keeps 0 dB for an EQ that only cuts", () => {
    expect(autoPreampDb(eq([band({ gain: -6 })]))).toBe(0);
  });

  it("counts a channel's own preamp", () => {
    const peq = eq([band({ gain: 2 })], 0, { [AudioChannel.FL]: 3 });
    expect(autoPreampDb(peq)).toBe(-5);
  });
});
