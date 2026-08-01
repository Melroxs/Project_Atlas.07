// packages/claim-intelligence/src/event-bus.ts
import { DomainEvent, DomainEventType, EventSubscriber } from './types';

/**
 * Lightweight typed in-process event bus.
 *
 * Design: modules publish DomainEvents; subscribers react. New modules can
 * subscribe without touching existing publishers — the event-driven contract
 * from PLAT-006, sized for a single-process Fastify server.
 */
class ClaimEventBus {
  private subscribers = new Map<DomainEventType | '*', Set<EventSubscriber>>();
  private history: DomainEvent[] = [];

  /** Subscribe to a specific event type or '*' for all. Returns unsubscribe. */
  subscribe(type: DomainEventType | '*', fn: EventSubscriber): () => void {
    const set = this.subscribers.get(type) ?? new Set();
    set.add(fn);
    this.subscribers.set(type, set);
    return () => set.delete(fn);
  }

  /** Publish an event: record history, dispatch to subscribers (errors isolated). */
  async publish(event: DomainEvent): Promise<void> {
    this.history.push(event);
    const targets = [
      ...(this.subscribers.get(event.eventType) ?? []),
      ...(this.subscribers.get('*') ?? []),
    ];
    await Promise.all(
      targets.map(async (fn) => {
        try {
          await fn(event);
        } catch (err) {
          // A failing subscriber must never break the publisher or other subscribers.
          console.error('[claim-event-bus] subscriber failed:', err);
        }
      })
    );
  }

  getHistory(): DomainEvent[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }
}

export const claimEventBus = new ClaimEventBus();
