/**
 * SuperKafe Mobile - Simple EventEmitter
 * 
 * Lightweight event system to replace browser's window.dispatchEvent/addEventListener.
 * Used for global events like subscription-expired, tenant-invalid, etc.
 */

type EventCallback = (...args: any[]) => void;

export class EventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  /**
   * Subscribe to an event
   * @returns Unsubscribe function
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function for cleanup
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /** Emit an event with data */
  emit(event: string, ...args: any[]): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(...args);
        } catch (error) {
          console.error(`[EventEmitter] Error in listener for "${event}":`, error);
        }
      });
    }
  }

  /** Remove all listeners for an event */
  off(event: string): void {
    this.listeners.delete(event);
  }

  /** Remove all listeners */
  clear(): void {
    this.listeners.clear();
  }
}
