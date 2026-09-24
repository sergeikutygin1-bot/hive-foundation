/** Dev-only frame-rate readout. */
export function createFpsMeter(): { el: HTMLElement; frame(dtSec: number): void } {
  const el = document.createElement('div');
  el.className = 'fps';
  let frames = 0;
  let time = 0;
  return {
    el,
    frame(dtSec: number) {
      frames += 1;
      time += dtSec;
      if (time >= 0.5 - 1e-9) {
        el.textContent = `${Math.round(frames / time)} fps`;
        frames = 0;
        time = 0;
      }
    },
  };
}
