/**
 * A small typed event bus. Handlers are keyed by the event's `type`
 * discriminant, so `on('QuestStarted', e => e.questId)` is fully typed.
 * A throwing handler is isolated (logged) so one broken listener cannot stop
 * the others or corrupt game flow.
 */
export interface TypedEvent {
  type: string;
}

type Handler<E> = (event: E) => void;

export class TypedEventBus<E extends TypedEvent> {
  private readonly handlers = new Map<E['type'], Set<Handler<E>>>();
  private readonly anyHandlers = new Set<Handler<E>>();

  constructor(private readonly onHandlerError: (error: unknown, event: E) => void = () => {}) {}

  on<T extends E['type']>(type: T, handler: Handler<Extract<E, { type: T }>>): () => void {
    const set = this.handlers.get(type) ?? new Set<Handler<E>>();
    set.add(handler as Handler<E>);
    this.handlers.set(type, set);
    return () => {
      set.delete(handler as Handler<E>);
    };
  }

  onAny(handler: Handler<E>): () => void {
    this.anyHandlers.add(handler);
    return () => {
      this.anyHandlers.delete(handler);
    };
  }

  emit(event: E): void {
    const specific = [...(this.handlers.get(event.type as E['type']) ?? [])];
    for (const handler of [...specific, ...this.anyHandlers]) {
      try {
        handler(event);
      } catch (error) {
        this.onHandlerError(error, event);
      }
    }
  }

  emitAll(events: readonly E[]): void {
    events.forEach((e) => this.emit(e));
  }

  clear(): void {
    this.handlers.clear();
    this.anyHandlers.clear();
  }
}
