import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, ref, type EffectScope } from "vue";
import {
  AudioChannel,
  DSPFilterType,
  ParametricEQBandType,
  type ParametricEQFilter,
} from "@/plugins/api/interfaces";
import { EQ_HISTORY_DEBOUNCE_MS, useEqHistory } from "./useEqHistory";

const makeEq = (gain = 0): ParametricEQFilter => ({
  type: DSPFilterType.PARAMETRIC_EQ,
  enabled: true,
  preamp: 0,
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

describe("useEqHistory", () => {
  let scope: EffectScope;

  beforeEach(() => {
    vi.useFakeTimers();
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
    vi.useRealTimers();
  });

  const setup = (eq = makeEq()) => {
    const peq = ref(eq);
    const history = scope.run(() => useEqHistory(peq))!;
    return { peq, history };
  };

  const change = async (apply: () => void) => {
    apply();
    await nextTick();
    vi.advanceTimersByTime(EQ_HISTORY_DEBOUNCE_MS);
  };

  it("undoes and redoes a change in the same filter object", async () => {
    const { peq, history } = setup();
    const filter = peq.value;
    expect(history.canUndo.value).toBe(false);

    await change(() => (peq.value.bands[0].gain = 4));
    expect(history.canUndo.value).toBe(true);

    history.undo();
    expect(peq.value).toBe(filter);
    expect(peq.value.bands[0].gain).toBe(0);
    expect(history.canRedo.value).toBe(true);

    history.redo();
    expect(peq.value.bands[0].gain).toBe(4);
    expect(history.canRedo.value).toBe(false);
  });

  it("treats quick successive changes as one step", async () => {
    const { peq, history } = setup();
    for (const gain of [1, 2, 3]) {
      peq.value.bands[0].gain = gain;
      await nextTick();
      vi.advanceTimersByTime(EQ_HISTORY_DEBOUNCE_MS / 2);
    }
    vi.advanceTimersByTime(EQ_HISTORY_DEBOUNCE_MS);
    history.undo();
    expect(peq.value.bands[0].gain).toBe(0);
    expect(history.canUndo.value).toBe(false);
  });

  it("makes a committed edit its own step, however quick the next one", async () => {
    const { peq, history } = setup();
    peq.value.bands[0].frequency = 500;
    history.commit();
    peq.value.bands[0].gain = 2;
    history.commit();
    history.undo();
    expect(peq.value.bands[0]).toMatchObject({ frequency: 500, gain: 0 });
    history.undo();
    expect(peq.value.bands[0].frequency).toBe(1000);
  });

  it("can undo a change that is still waiting for its debounce", async () => {
    const { peq, history } = setup();
    peq.value.preamp = -3;
    await nextTick();
    expect(history.canUndo.value).toBe(true);
    history.undo();
    expect(peq.value.preamp).toBe(0);
  });

  it("drops the redo steps after a new change", async () => {
    const { peq, history } = setup();
    await change(() => (peq.value.bands[0].gain = 4));
    history.undo();
    await change(() => (peq.value.bands[0].q = 2));
    expect(history.canRedo.value).toBe(false);
  });

  it("keeps the history when the server echoes the same EQ back", async () => {
    const { peq, history } = setup();
    await change(() => (peq.value.bands[0].gain = 4));
    peq.value = JSON.parse(JSON.stringify(peq.value)) as ParametricEQFilter;
    await nextTick();
    expect(history.canUndo.value).toBe(true);
    history.undo();
    expect(peq.value.bands[0].gain).toBe(0);
  });

  it("starts over when another EQ is loaded", async () => {
    const { peq, history } = setup();
    await change(() => (peq.value.bands[0].gain = 4));
    peq.value = makeEq(-6);
    await nextTick();
    expect(history.canUndo.value).toBe(false);
    history.undo();
    expect(peq.value.bands[0].gain).toBe(-6);
  });
});
