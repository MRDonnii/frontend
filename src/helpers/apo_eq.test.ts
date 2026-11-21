import { describe, expect, it } from "vitest";
import { ParametricEQBandType } from "@/plugins/api/interfaces";
import {
  APO_FIXED_PASS_Q,
  bandTypeHasGain,
  bandwidthToQ,
  formatApoFilterLine,
  parseApoFilterLine,
} from "./apo_eq";

describe("parseApoFilterLine", () => {
  it("reads a Room EQ Wizard peak filter", () => {
    expect(
      parseApoFilterLine("Filter 1: ON PK Fc 29.15 Hz Gain -9.60 dB Q 1.007"),
    ).toEqual({
      enabled: true,
      type: ParametricEQBandType.PEAK,
      frequency: 29.15,
      gain: -9.6,
      q: 1.007,
    });
  });

  it("reads the short Equalizer APO form without keywords", () => {
    expect(parseApoFilterLine("Filter: ON PK 29.15 Hz -9.60 dB 1.007")).toEqual(
      {
        enabled: true,
        type: ParametricEQBandType.PEAK,
        frequency: 29.15,
        gain: -9.6,
        q: 1.007,
      },
    );
  });

  it("reads AutoEQ's LSC and HSC lines as shelves, keeping their Q", () => {
    expect(
      parseApoFilterLine("Filter 1: ON LSC Fc 105 Hz Gain 6.5 dB Q 0.70"),
    ).toMatchObject({
      type: ParametricEQBandType.LOW_SHELF,
      frequency: 105,
      gain: 6.5,
      q: 0.7,
    });
    expect(
      parseApoFilterLine("Filter 10: ON HSC Fc 10000 Hz Gain -3.2 dB Q 0.70"),
    ).toMatchObject({
      type: ParametricEQBandType.HIGH_SHELF,
      gain: -3.2,
      q: 0.7,
    });
  });

  it("converts a bandwidth in octaves to Q", () => {
    const filter = parseApoFilterLine(
      "Filter: ON PK Fc 1000 Hz Gain 3 dB BW Oct 1",
    );
    expect(filter?.q).toBeCloseTo(Math.SQRT2, 6);
    expect(filter?.q).toBeCloseTo(bandwidthToQ(1), 12);
  });

  it("reads cuts and notches written without a gain", () => {
    expect(parseApoFilterLine("Filter 2: ON HPQ Fc 30 Hz Q 0.5")).toEqual({
      enabled: true,
      type: ParametricEQBandType.HIGH_PASS,
      frequency: 30,
      gain: 0,
      q: 0.5,
    });
    expect(
      parseApoFilterLine("Filter 3: ON LPQ Fc 16000 Hz Q 0.9"),
    ).toMatchObject({ type: ParametricEQBandType.LOW_PASS, gain: 0, q: 0.9 });
    const notch = parseApoFilterLine("Filter 4: ON NO Fc 50 Hz BW Oct 0.1");
    expect(notch).toMatchObject({ type: ParametricEQBandType.NOTCH, gain: 0 });
    expect(notch?.q).toBeCloseTo(bandwidthToQ(0.1), 12);
  });

  it("gives HP and LP their fixed Butterworth Q", () => {
    expect(parseApoFilterLine("Filter: ON HP Fc 25 Hz")).toMatchObject({
      type: ParametricEQBandType.HIGH_PASS,
      q: APO_FIXED_PASS_Q,
    });
    expect(parseApoFilterLine("Filter: ON LP Fc 18000 Hz")).toMatchObject({
      type: ParametricEQBandType.LOW_PASS,
      q: APO_FIXED_PASS_Q,
    });
  });

  it("keeps the Q that older exports wrote on HP and shelf lines", () => {
    expect(
      parseApoFilterLine("Filter 1: ON HP Fc 40.0 Hz Gain 0.00 dB Q 0.500"),
    ).toMatchObject({ type: ParametricEQBandType.HIGH_PASS, q: 0.5 });
    expect(
      parseApoFilterLine("Filter 2: ON LS Fc 80.0 Hz Gain 4.00 dB Q 0.700"),
    ).toMatchObject({ type: ParametricEQBandType.LOW_SHELF, q: 0.7 });
  });

  it("reads switched-off filters and Windows line endings", () => {
    expect(
      parseApoFilterLine("Filter 5: OFF PK Fc 2000 Hz Gain 2 dB Q 2\r"),
    ).toMatchObject({ enabled: false, frequency: 2000, q: 2 });
  });

  it("skips what cannot be a band instead of guessing", () => {
    // unsupported types are not turned into peaks
    expect(parseApoFilterLine("Filter: ON BP Fc 1000 Hz Q 1")).toBeNull();
    expect(parseApoFilterLine("Filter: ON AP Fc 1000 Hz Q 1")).toBeNull();
    expect(parseApoFilterLine("Filter 6: ON None")).toBeNull();
    // a peak or shelf needs a gain and a Q
    expect(parseApoFilterLine("Filter: ON PK Fc 1000 Hz Q 1")).toBeNull();
    expect(parseApoFilterLine("Filter: ON PK Fc 1000 Hz Gain 3 dB")).toBeNull();
    expect(parseApoFilterLine("Filter: ON HPQ Fc 30 Hz")).toBeNull();
    expect(parseApoFilterLine("Preamp: -6 dB")).toBeNull();
  });
});

describe("formatApoFilterLine", () => {
  it("writes shelves and cuts in the forms APO reads with a centre frequency and Q", () => {
    expect(
      formatApoFilterLine(
        {
          enabled: true,
          type: ParametricEQBandType.LOW_SHELF,
          frequency: 105,
          gain: 6.5,
          q: 0.7,
        },
        1,
      ),
    ).toBe("Filter 1: ON LSC Fc 105.0 Hz Gain 6.50 dB Q 0.700");
    expect(
      formatApoFilterLine(
        {
          enabled: false,
          type: ParametricEQBandType.HIGH_PASS,
          frequency: 30,
          gain: 0,
          q: 0.5,
        },
        2,
      ),
    ).toBe("Filter 2: OFF HPQ Fc 30.0 Hz Q 0.500");
  });

  it("round-trips every band type through parseApoFilterLine", () => {
    for (const type of Object.values(ParametricEQBandType)) {
      const filter = {
        enabled: true,
        type,
        frequency: 250,
        gain: bandTypeHasGain(type) ? -4.5 : 0,
        q: 1.25,
      };
      expect(parseApoFilterLine(formatApoFilterLine(filter, 1))).toEqual(
        filter,
      );
    }
  });
});
