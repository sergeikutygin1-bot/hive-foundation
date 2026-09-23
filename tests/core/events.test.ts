import { describe, expect, it } from 'vitest';
import { EventBus } from '../../src/core/events';

type E = { type: 'a'; n: number } | { type: 'b'; s: string };

describe('EventBus', () => {
  it('delivers typed events to matching listeners only', () => {
    const bus = new EventBus<E>();
    const got: number[] = [];
    bus.on('a', (e) => got.push(e.n));
    bus.emit({ type: 'a', n: 1 });
    bus.emit({ type: 'b', s: 'x' });
    expect(got).toEqual([1]);
  });

  it('onAny sees every event', () => {
    const bus = new EventBus<E>();
    const types: string[] = [];
    bus.onAny((e) => types.push(e.type));
    bus.emit({ type: 'a', n: 1 });
    bus.emit({ type: 'b', s: 'x' });
    expect(types).toEqual(['a', 'b']);
  });

  it('unsubscribes', () => {
    const bus = new EventBus<E>();
    let count = 0;
    const off = bus.on('a', () => count++);
    const offAny = bus.onAny(() => count++);
    off();
    offAny();
    bus.emit({ type: 'a', n: 1 });
    expect(count).toBe(0);
  });

  it('tolerates a listener unsubscribing during emit', () => {
    const bus = new EventBus<E>();
    const calls: string[] = [];
    const off = bus.on('a', () => {
      calls.push('first');
      off();
    });
    bus.on('a', () => calls.push('second'));
    bus.emit({ type: 'a', n: 1 });
    bus.emit({ type: 'a', n: 2 });
    expect(calls).toEqual(['first', 'second', 'second']);
  });
});
