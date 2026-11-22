import { ref, type Ref } from "vue";
import type { ParametricEQBand } from "@/plugins/api/interfaces";
import {
  bandValuesAt,
  findHandleAt,
  freqToX,
  gainToY,
  HANDLE_HIT_RADIUS_MOUSE,
  HANDLE_HIT_RADIUS_TOUCH,
  scrollQ,
  type EqGraphPoint,
  type EqGraphViewport,
} from "@/helpers/eq_graph";

export interface EqGraphPointerOptions {
  canvas: Ref<HTMLCanvasElement | null>;
  viewport: Ref<EqGraphViewport>;
  bands: () => ParametricEQBand[];
  // Whether a band is drawn in the current channel view, so it can be grabbed.
  isShown: (band: ParametricEQBand) => boolean;
  // Cuts and notches have no gain, so dragging them only moves the frequency.
  hasGain: (band: ParametricEQBand) => boolean;
  onSelect: (index: number) => void;
  onAdd: (frequency: number, gain: number) => void;
  // Called when a drag ends or a band was added, so it can be one undo step.
  onEditEnd?: () => void;
}

/**
 * Mouse and touch editing on the EQ graph: drag a band's handle to change its
 * frequency and gain, scroll over a handle to change its Q, and double-click
 * an empty spot to add a band there.
 */
export function useEqGraphPointer(options: EqGraphPointerOptions) {
  const hoveringHandle = ref(false);
  const dragging = ref(false);
  let drag: { index: number; pointerId: number } | null = null;

  const pointIn = (event: MouseEvent | Touch): EqGraphPoint | null => {
    const rect = options.canvas.value?.getBoundingClientRect();
    if (!rect) return null;
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handleAt = (point: EqGraphPoint, touch: boolean): number => {
    const viewport = options.viewport.value;
    const handles = options.bands().map((band) =>
      options.isShown(band)
        ? {
            x: freqToX(band.frequency, viewport),
            y: gainToY(band.gain, viewport),
          }
        : null,
    );
    return findHandleAt(
      handles,
      point,
      touch ? HANDLE_HIT_RADIUS_TOUCH : HANDLE_HIT_RADIUS_MOUSE,
    );
  };

  const onPointerDown = (event: PointerEvent) => {
    const point = pointIn(event);
    if (!point || event.button !== 0) return;
    const index = handleAt(point, event.pointerType === "touch");
    if (index < 0) return;
    event.preventDefault();
    options.onSelect(index);
    options.canvas.value?.setPointerCapture(event.pointerId);
    drag = { index, pointerId: event.pointerId };
    dragging.value = true;
  };

  const onPointerMove = (event: PointerEvent) => {
    const point = pointIn(event);
    if (!point) return;
    if (!drag || drag.pointerId !== event.pointerId) {
      hoveringHandle.value = handleAt(point, false) >= 0;
      return;
    }
    const band = options.bands()[drag.index];
    if (!band) return;
    const values = bandValuesAt(point, options.viewport.value);
    band.frequency = values.frequency;
    if (options.hasGain(band)) band.gain = values.gain;
  };

  const onPointerUp = (event: PointerEvent) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (options.canvas.value?.hasPointerCapture(event.pointerId)) {
      options.canvas.value.releasePointerCapture(event.pointerId);
    }
    drag = null;
    dragging.value = false;
    options.onEditEnd?.();
  };

  const onPointerLeave = () => {
    if (!drag) hoveringHandle.value = false;
  };

  // Only a scroll over a handle is taken; anywhere else the page scrolls.
  const onWheel = (event: WheelEvent) => {
    const point = pointIn(event);
    if (!point || event.deltaY === 0) return;
    const index = handleAt(point, false);
    if (index < 0) return;
    event.preventDefault();
    const band = options.bands()[index];
    band.q = scrollQ(band.q, event.deltaY);
    options.onSelect(index);
  };

  const onDoubleClick = (event: MouseEvent) => {
    const point = pointIn(event);
    if (!point || handleAt(point, false) >= 0) return;
    const values = bandValuesAt(point, options.viewport.value);
    options.onAdd(values.frequency, values.gain);
    options.onEditEnd?.();
  };

  // A finger on a handle drags it instead of scrolling the page.
  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    const point = touch ? pointIn(touch) : null;
    if (point && handleAt(point, true) >= 0) event.preventDefault();
  };

  return {
    hoveringHandle,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onWheel,
    onDoubleClick,
    onTouchStart,
  };
}
