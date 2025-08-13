type Handler<T = any> = (payload: T) => void;

export type Events = {
  "auth:signed_in": { userId: string };
  "auth:signed_out": null;
  "auth:token_refreshed": { userId?: string } | null;
  "network:online": null;
  "network:offline": null;
  "offline:pending_changed": { pendingCount: number };
  "app:foreground": null;
};

export class EventBus {
  private handlers: Map<string, Set<Handler>> = new Map();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>) {
    const set = this.handlers.get(event as string) || new Set<Handler>();
    set.add(handler as Handler);
    this.handlers.set(event as string, set);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>) {
    const set = this.handlers.get(event as string);
    if (!set) return;
    set.delete(handler as Handler);
    if (set.size === 0) this.handlers.delete(event as string);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    const set = this.handlers.get(event as string);
    if (!set) return;
    // Call handlers synchronously; handlers should be resilient to errors.
    for (const h of Array.from(set)) {
      try {
        (h as Handler)(payload);
      } catch (err) {
        // Swallow to avoid breaking other handlers
        // eslint-disable-next-line no-console
        console.warn(`Event handler for ${String(event)} threw error:`, err);
      }
    }
  }
}

export const events = new EventBus();
