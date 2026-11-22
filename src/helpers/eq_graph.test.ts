import { describe, expect, it } from "vitest";
import {
  BAND_GAIN_LIMIT_DB,
  BAND_Q_MAX,
  BAND_Q_MIN,
  bandValuesAt,
  findHandleAt,
  freqToX,
  gainToY,
  Q_SCROLL_FACTOR,
  scrollQ,
  xToFreq,
  yToGain,
  type EqGraphViewport,
} from "./eq_graph";

const viewport: EqGraphViewport = {
  width: 700,
  height: 200,
  min_gain: -20,
  max_gain: 20,
  min_freq: 20,
  max_freq: 20000,
  padding_lr: 40,
  padding_right: 8,
  padding_tb: 20,
};

describe("graph coordinates", () => {
  it("maps the frequency range onto the plot area", () => {
    expect(freqToX(20, viewport)).toBeCloseTo(40, 6);
    expect(freqToX(20000, viewport)).toBeCloseTo(700 - 8, 6);
  });

  it("turns x back into the same frequency", () => {
    for (const freq of [20, 63, 1000, 12500]) {
      expect(xToFreq(freqToX(freq, viewport), viewport)).toBeCloseTo(freq, 6);
    }
  });

  it("keeps frequencies outside the plot within the range", () => {
    expect(xToFreq(0, viewport)).toBe(20);
    expect(xToFreq(5000, viewport)).toBe(20000);
  });

  it("puts 0 dB in the middle and turns y back into the same gain", () => {
    expect(gainToY(0, viewport)).toBe(100);
    expect(gainToY(20, viewport)).toBeCloseTo(20, 6);
    for (const gain of [-12, -0.5, 0, 3, 20]) {
      expect(yToGain(gainToY(gain, viewport), viewport)).toBeCloseTo(gain, 6);
    }
  });
});

describe("findHandleAt", () => {
  const handles = [{ x: 100, y: 100 }, null, { x: 108, y: 100 }];

  it("picks the closest handle within the radius", () => {
    expect(findHandleAt(handles, { x: 101, y: 101 }, 10)).toBe(0);
    expect(findHandleAt(handles, { x: 107, y: 99 }, 10)).toBe(2);
  });

  it("finds nothing outside the radius or for hidden bands", () => {
    expect(findHandleAt(handles, { x: 130, y: 100 }, 10)).toBe(-1);
    expect(findHandleAt([null], { x: 0, y: 0 }, 10)).toBe(-1);
  });
});

describe("bandValuesAt", () => {
  it("rounds like the sliders", () => {
    const point = { x: freqToX(1234.4, viewport), y: gainToY(3.27, viewport) };
    expect(bandValuesAt(point, viewport)).toEqual({
      frequency: 1234,
      gain: 3.3,
    });
  });

  it("keeps the gain within the slider's range", () => {
    expect(bandValuesAt({ x: 300, y: 0 }, viewport).gain).toBe(
      BAND_GAIN_LIMIT_DB,
    );
    expect(bandValuesAt({ x: 300, y: 200 }, viewport).gain).toBe(
      -BAND_GAIN_LIMIT_DB,
    );
  });
});

describe("scrollQ", () => {
  it("narrows the band when scrolling up and widens it when scrolling down", () => {
    expect(scrollQ(1, -100)).toBeCloseTo(Q_SCROLL_FACTOR, 2);
    expect(scrollQ(1, 100)).toBeCloseTo(1 / Q_SCROLL_FACTOR, 2);
  });

  it("keeps Q within the slider's range", () => {
    expect(scrollQ(BAND_Q_MAX, -1)).toBe(BAND_Q_MAX);
    expect(scrollQ(BAND_Q_MIN, 1)).toBe(BAND_Q_MIN);
  });
});
