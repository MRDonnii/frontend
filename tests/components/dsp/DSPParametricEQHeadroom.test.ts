import DSPParametricEQHeadroom from "@/components/dsp/DSPParametricEQHeadroom.vue";
import {
  AudioChannel,
  DSPFilterType,
  ParametricEQBandType,
  type ParametricEQFilter,
} from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { nextTick, reactive } from "vue";

const makeEq = (gain: number, preamp = 0): ParametricEQFilter => ({
  type: DSPFilterType.PARAMETRIC_EQ,
  enabled: true,
  preamp,
  per_channel_preamp: {},
  bands: [
    {
      frequency: 1000,
      q: 1,
      gain,
      type: ParametricEQBandType.PEAK,
      enabled: true,
      channel: AudioChannel.ALL,
    },
  ],
});

// The editor hands down its reactive filter and the preamp is changed in place.
const mountHeadroom = (eq: ParametricEQFilter) =>
  mount(DSPParametricEQHeadroom, { props: { modelValue: eq } });

describe("DSPParametricEQHeadroom", () => {
  it("warns when the EQ's boosts go above 0 dB and fixes it with Auto preamp", async () => {
    const eq = reactive(makeEq(6));
    const wrapper = mountHeadroom(eq);
    expect(wrapper.text()).toContain("+6.0 dB");
    expect(wrapper.text()).toContain("can clip");

    const button = wrapper.get("button");
    await button.trigger("click");
    await nextTick();

    expect(eq.preamp).toBe(-6);
    expect(wrapper.text()).not.toContain("can clip");
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
  });

  it("shows the level without a warning for an EQ that only cuts", () => {
    const wrapper = mountHeadroom(makeEq(-4, -2));
    expect(wrapper.text()).toContain("-2.0 dB");
    expect(wrapper.text()).not.toContain("can clip");
  });
});
