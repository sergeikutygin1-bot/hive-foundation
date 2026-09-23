type Listener<E> = (e: E) => void;

/** Typed pub/sub for discriminated-union events ({ type: ... }). */
export class EventBus<E extends { type: string }> {
  private readonly byType = new Map<string, Set<Listener<E>>>();
  private readonly any = new Set<Listener<E>>();

  on<T extends E['type']>(type: T, fn: (e: Extract<E, { type: T }>) => void): () => void {
    let set = this.byType.get(type);
    if (!set) {
      set = new Set();
      this.byType.set(type, set);
    }
    const listener = fn as Listener<E>;
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  onAny(fn: Listener<E>): () => void {
    this.any.add(fn);
    return () => {
      this.any.delete(fn);
    };
  }

  emit(e: E): void {
    for (const fn of [...(this.byType.get(e.type) ?? [])]) fn(e);
    for (const fn of [...this.any]) fn(e);
  }
}
