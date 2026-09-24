export type KeyRoute = 'game' | 'ui' | 'ignore';

type KeyInfo = Pick<KeyboardEvent, 'key' | 'target' | 'ctrlKey' | 'metaKey' | 'altKey'>;

/**
 * Who owns a keydown: game shortcuts, the focused UI control, or nobody.
 * A button clicked with the mouse keeps focus in every browser; only a button the player reached by
 * keyboard keeps Space/Enter, otherwise Space would re-press "2x" or "Sell all" instead of pausing.
 */
export function routeKey(e: KeyInfo, isKeyboardFocused: (el: Element) => boolean): KeyRoute {
  if (e.ctrlKey || e.metaKey || e.altKey) return 'ignore';
  const target = e.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return 'ui';
  if (target instanceof HTMLButtonElement && (e.key === ' ' || e.key === 'Enter') && isKeyboardFocused(target)) return 'ui';
  return 'game';
}

/**
 * Remembers whether focus last moved by pointer or by keyboard. Checking `:focus-visible` inside a
 * keydown handler doesn't work: Chrome flips it on for the very key press we are routing.
 */
export function createFocusTracker(target: Window): { isKeyboardFocused(): boolean; dispose(): void } {
  let byPointer = false;
  const onPointer = () => {
    byPointer = true;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Tab') byPointer = false;
  };
  target.addEventListener('pointerdown', onPointer, true);
  target.addEventListener('keydown', onKey, true);
  return {
    isKeyboardFocused: () => !byPointer,
    dispose() {
      target.removeEventListener('pointerdown', onPointer, true);
      target.removeEventListener('keydown', onKey, true);
    },
  };
}
