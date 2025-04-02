// Computation-based Event implementation
export class Event<A> {
  // Computation function that handles subscriber transformations
  private computation: (subscriber: (value: A) => void) => () => void;

  // Optional list of subscribers for source events
  private subscribers?: Array<(value: A) => void>;

  /**
   * Create a new event
   * @param computation Optional computation function for derived events
   */
  constructor(computation?: (subscriber: (value: A) => void) => () => void) {
    if (computation) {
      // This is a derived event with a provided computation
      this.computation = computation;
    } else {
      // This is a source event, set up subscribers list
      this.subscribers = [];

      // Define the computation for source events
      this.computation = (subscriber) => {
        this.subscribers!.push(subscriber);

        // Return unsubscribe function
        return () => {
          const index = this.subscribers!.indexOf(subscriber);
          if (index >= 0) {
            this.subscribers!.splice(index, 1);
          }
        };
      };
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
    return new Event<A>(() => () => {
      /* no-op */
    });
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
    return this.computation(handler);
  }

  /**
   * Map this event
   */
  map<B>(f: (a: A) => B): Event<B> {
    return new Event<B>((subscriber) =>
      this.computation((a) => {
        try {
          subscriber(f(a));
        } catch (error) {
          console.error("Error in map function:", error);
        }
      }),
    );
  }
}
