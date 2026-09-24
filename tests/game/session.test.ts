import { describe, expect, it, vi } from 'vitest';
import { hex } from '../../src/core/hex';
import { Session } from '../../src/game/session';
import { newGame, reg } from '../sim/helpers';

const placeBed = { type: 'place', def: 'bed_wildflower', hex: hex(1, -1) } as const;

describe('Session', () => {
  it('emits events and notifies listeners on a successful command', () => {
    const session = new Session(reg, newGame(1), true);
    const seen: string[] = [];
    session.events.onAny((e) => seen.push(e.type));
    const changed = vi.fn();
    session.onChange(changed);
    expect(session.dispatch(placeBed).ok).toBe(true);
    expect(seen).toEqual(['entityPlaced']);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('stays quiet on a rejected command', () => {
    const session = new Session(reg, newGame(1), true);
    const changed = vi.fn();
    session.onChange(changed);
    session.events.onAny(changed);
    expect(session.dispatch({ type: 'harvestAll' })).toEqual({ ok: false, reason: 'nothing_to_harvest' });
    expect(changed).not.toHaveBeenCalled();
  });

  it('steps the sim and forwards its events', () => {
    const session = new Session(reg, newGame(1), true);
    const seen: string[] = [];
    session.events.onAny((e) => seen.push(e.type));
    session.step(600);
    expect(session.state.clock.tick).toBe(600);
    expect(seen).toContain('dayStarted');
  });

  it('ignores zero-tick steps', () => {
    const session = new Session(reg, newGame(1), true);
    const changed = vi.fn();
    session.onChange(changed);
    session.step(0);
    expect(changed).not.toHaveBeenCalled();
  });

  it('rethrows sim invariant errors in strict (dev) mode', () => {
    const session = new Session(reg, newGame(1), true);
    session.state.entities.e1.def = 'missing';
    expect(() => session.step(1)).toThrow();
  });

  it('logs and keeps running in lenient (production) mode', () => {
    const session = new Session(reg, newGame(1), false);
    session.state.entities.e1.def = 'missing';
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => session.step(1)).not.toThrow();
    expect(session.dispatch({ type: 'harvest', id: 'e1' })).toEqual({ ok: false, reason: 'internal_error' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
