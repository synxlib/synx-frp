import { Future } from "./1-future";
// Event implementation using Future
export class Event<A> {
  // The underlying future
  private future: Future<A>;

  // Subscribers for source events
  private subscribers?: Array<(value: A) => void>;

  /**
   * Create a new event
   */
  constructor(future?: Future<A>) {
    if (future) {
      // This is a derived event with a provided future
      this.future = future;
    } else {
      // This is a source event, set up subscribers list
      this.subscribers = [];

      // Create a future that manages the subscribers
      this.future = new Future<A>((handler) => {
        this.subscribers!.push(handler);
        return () => {
          const index = this.subscribers!.indexOf(handler);
          if (index >= 0) {
            this.subscribers!.splice(index, 1);
          }
        };
      });
    }
  }

  /**
   * Static factory for creating events with an emitter
   */
  static create<A>(): [Event<A>, (value: A) => void] {
    const event = new Event<A>();
    return [event, (value: A) => event.emit(value)];
  }

  /**
   * Static factory for never events
   */
  static never<A>(): Event<A> {
    return new Event<A>(Future.never<A>());
  }

  /**
   * Emit a value to this event (for source events)
   */
  emit(value: A): void {
    console.log(`Emitting value:`, value);

    if (!this.subscribers) {
      throw new Error("Cannot emit on derived events");
    }

    this.subscribers.forEach((sub) => {
      try {
        sub(value);
      } catch (error) {
        console.error("Error in subscriber:", error);
      }
    });
  }

  /**
   * Subscribe to this event
   */
  subscribe(handler: (value: A) => void): () => void {
    return this.future.run(handler);
  }

  /**
   * Map this event
   */
  map<B>(f: (a: A) => B): Event<B> {
    return new Event<B>(this.future.map(f));
  }
}
