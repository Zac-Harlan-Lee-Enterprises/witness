/**
 * Minimal observable store, compatible with React's useSyncExternalStore.
 * Used for UI state and session snapshots — each store owns one slice of
 * state; there is no global mutable god-object.
 */
export class Store<T> {
  private readonly listeners = new Set<() => void>();

  constructor(private state: T) {}

  getState = (): T => this.state;

  setState(update: T | ((prev: T) => T)): void {
    const next = typeof update === 'function' ? (update as (prev: T) => T)(this.state) : update;
    if (Object.is(next, this.state)) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
}
