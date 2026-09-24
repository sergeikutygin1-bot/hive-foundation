export const DRAG_THRESHOLD_PX = 5;

export function isDrag(dx: number, dy: number, threshold = DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(dx, dy) >= threshold;
}

export interface InputHandlers {
  pan(dxPx: number, dyPx: number): void;
  zoom(deltaY: number): void;
  /** factor > 1: fingers moved apart. */
  pinch(factor: number): void;
  hover(clientX: number, clientY: number): void;
  click(clientX: number, clientY: number): void;
  cancel(): void;
  leave(): void;
}

type Point = { x: number; y: number };

/** Pointer/wheel handling for the world canvas: click vs drag, pinch zoom, right-click cancel. */
export function attachInput(el: HTMLElement, h: InputHandlers): () => void {
  const pointers = new Map<number, Point>();
  let downAt: Point | null = null;
  let dragging = false;
  let pinchDistance = 0;

  const twoPointerDistance = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onDown = (e: PointerEvent) => {
    if (e.button === 2) {
      h.cancel();
      return;
    }
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Not supported (tests) or pointer already gone: capture is only a nicety for drags leaving the canvas.
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      downAt = { x: e.clientX, y: e.clientY };
      dragging = false;
    } else if (pointers.size === 2) {
      pinchDistance = twoPointerDistance();
      dragging = true;
    }
  };

  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      h.hover(e.clientX, e.clientY);
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const d = twoPointerDistance();
      if (pinchDistance > 0) h.pinch(d / pinchDistance);
      pinchDistance = d;
      return;
    }
    if (downAt && !dragging && isDrag(e.clientX - downAt.x, e.clientY - downAt.y)) dragging = true;
    if (dragging) h.pan(e.clientX - prev.x, e.clientY - prev.y);
    else h.hover(e.clientX, e.clientY);
  };

  const onUp = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      if (!dragging && downAt) h.click(e.clientX, e.clientY);
      downAt = null;
      dragging = false;
      pinchDistance = 0;
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    h.zoom(e.deltaY);
  };
  const onContextMenu = (e: Event) => e.preventDefault();
  const onLeave = () => {
    if (pointers.size === 0) h.leave();
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('contextmenu', onContextMenu);

  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onUp);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('contextmenu', onContextMenu);
  };
}
