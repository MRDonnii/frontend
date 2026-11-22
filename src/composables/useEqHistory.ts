import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import type { ParametricEQFilter } from "@/plugins/api/interfaces";

// Changes closer together than this, such as one drag or slider move, are a
// single undo step.
export const EQ_HISTORY_DEBOUNCE_MS = 500;
export const EQ_HISTORY_LIMIT = 50;

type EqState = Pick<
  ParametricEQFilter,
  "preamp" | "per_channel_preamp" | "bands"
>;

const snapshot = (eq: ParametricEQFilter): string =>
  JSON.stringify({
    preamp: eq.preamp,
    per_channel_preamp: eq.per_channel_preamp,
    bands: eq.bands,
  } satisfies EqState);

/**
 * Undo and redo for the parametric EQ's bands and preamps. A restored state is
 * written into the same filter object, so the editor's save path is unchanged.
 * The history starts over when a filter with other settings arrives (another
 * stage, a preset, a change from another client); the server's echo of our
 * own save is the same EQ and keeps it.
 */
export function useEqHistory(peq: Ref<ParametricEQFilter>) {
  const undoStack = ref<string[]>([]);
  const redoStack = ref<string[]>([]);
  // A change still waiting for its debounce can already be undone.
  const hasPendingChange = ref(false);
  let current = snapshot(peq.value);
  let pending: ReturnType<typeof setTimeout> | undefined;

  const cancelPending = () => {
    if (pending !== undefined) clearTimeout(pending);
    pending = undefined;
  };

  const record = () => {
    cancelPending();
    hasPendingChange.value = false;
    const next = snapshot(peq.value);
    // nothing changed, or the change was an undo/redo restoring `current`
    if (next === current) return;
    undoStack.value.push(current);
    if (undoStack.value.length > EQ_HISTORY_LIMIT) undoStack.value.shift();
    redoStack.value = [];
    current = next;
  };

  const restore = (state: string) => {
    const parsed = JSON.parse(state) as EqState;
    current = state;
    peq.value.preamp = parsed.preamp;
    peq.value.per_channel_preamp = parsed.per_channel_preamp;
    peq.value.bands = parsed.bands;
  };

  watch(
    peq,
    (eq, previous) => {
      if (eq !== previous && snapshot(eq) !== snapshot(previous)) {
        cancelPending();
        hasPendingChange.value = false;
        undoStack.value = [];
        redoStack.value = [];
        current = snapshot(eq);
        return;
      }
      hasPendingChange.value = snapshot(eq) !== current;
      cancelPending();
      pending = setTimeout(record, EQ_HISTORY_DEBOUNCE_MS);
    },
    { deep: true },
  );

  onScopeDispose(cancelPending);

  const undo = () => {
    record();
    const previous = undoStack.value.pop();
    if (previous === undefined) return;
    redoStack.value.push(current);
    restore(previous);
  };

  const redo = () => {
    record();
    const next = redoStack.value.pop();
    if (next === undefined) return;
    undoStack.value.push(current);
    restore(next);
  };

  return {
    // Records a finished edit (a drag, an added band) as its own step now.
    commit: record,
    canUndo: computed(
      () => undoStack.value.length > 0 || hasPendingChange.value,
    ),
    canRedo: computed(() => redoStack.value.length > 0),
    undo,
    redo,
  };
}
