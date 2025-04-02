import { Future } from "./1-future";
import { Reactive } from "./1-reactive";

// Event implementation using Future and Reactive
export class Event<A> {
  // The underlying future
  private future: Future<A>;

  // Source reactive value (only for source events)
  private sourceReactive?: Reactive<A>;

  /**
   * Create a new event
   */
  constructor(future?: Future<A>) {
    if (future) {
      // This is a derived event with a provided future
      this.future = future;
    } else {
      // This is a source event, create a reactive value
      this.sourceReactive = new Reactive<A>();

      // Create a future from the reactive's changes
      this.future = this.sourceReactive.changes();
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

    if (!this.sourceReactive) {
      throw new Error("Cannot emit on derived events");
    }

    this.sourceReactive.set(value);
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
