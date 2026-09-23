/** Real milliseconds per sim tick at 1x. Must match sim/clock TICKS_PER_SECOND (10). */
export const TICK_MS = 100;
/** Longest real frame we account for; longer gaps (hidden tab, hitch) are dropped, not fast-forwarded. */
export const MAX_FRAME_MS = 250;

export function ticksForFrame(accMs: number, frameMs: number, speed: number): { ticks: number; accMs: number } {
  if (speed <= 0) return { ticks: 0, accMs: 0 };
  const acc = accMs + Math.min(Math.max(frameMs, 0), MAX_FRAME_MS) * speed;
  const ticks = Math.floor(acc / TICK_MS);
  return { ticks, accMs: acc - ticks * TICK_MS };
}

export interface LoopHooks {
  getSpeed(): number;
  step(ticks: number): void;
  render(dtSec: number, timeSec: number): void;
}

/** Fixed-step sim, free-running render. Returns a stop function. */
export function startLoop(hooks: LoopHooks): () => void {
  let acc = 0;
  let last = performance.now();
  let running = true;
  let raf = 0;
  const frame = (now: number) => {
    if (!running) return;
    const frameMs = now - last;
    last = now;
    const r = ticksForFrame(acc, frameMs, hooks.getSpeed());
    acc = r.accMs;
    if (r.ticks > 0) hooks.step(r.ticks);
    hooks.render(Math.min(Math.max(frameMs, 0), MAX_FRAME_MS) / 1000, now / 1000);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
  };
}
