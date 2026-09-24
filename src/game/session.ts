import { EventBus } from '../core/events';
import type { Registry } from '../content/registry';
import { advance } from '../sim/advance';
import { dispatch, type Command, type CommandResult } from '../sim/commands';
import type { GameEvent } from '../sim/events';
import type { GameState } from '../sim/state';

/** Owns the live GameState: routes commands and ticks into the sim and fans out events. */
export class Session {
  readonly events = new EventBus<GameEvent>();
  private readonly listeners = new Set<() => void>();

  constructor(
    readonly reg: Registry,
    public state: GameState,
    private readonly strict: boolean = import.meta.env.DEV,
  ) {}

  dispatch(cmd: Command): CommandResult {
    let result: CommandResult;
    try {
      result = dispatch(this.state, this.reg, cmd);
    } catch (err) {
      this.fail(err);
      return { ok: false, reason: 'internal_error' };
    }
    if (result.ok) {
      for (const e of result.events) this.events.emit(e);
      this.notify();
    }
    return result;
  }

  step(ticks: number): void {
    if (ticks <= 0) return;
    let events: GameEvent[];
    try {
      events = advance(this.state, this.reg, ticks);
    } catch (err) {
      this.fail(err);
      return;
    }
    for (const e of events) this.events.emit(e);
    this.notify();
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    for (const fn of [...this.listeners]) fn();
  }

  /** Spec §9: sim invariant broken -> throw in dev, log and continue in production. */
  private fail(err: unknown): void {
    if (this.strict) throw err;
    console.error('[sim] invariant broken; continuing', err);
  }
}
