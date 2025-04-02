// Naive Event implementation with just map method
export class Event<A> {
  // List of subscribers
  private subscribers: Array<(value: A) => void> = [];

  // Create a new event
  constructor() {}

  // Static factory for creating events with an emitter
  static create<A>(): [Event<A>, (value: A) => void] {
    const event = new Event<A>();
    return [event, (value: A) => event.emit(value)];
  }

  // Static factory for never events
  static never<A>(): Event<A> {
    return new Event<A>();
  }

  // Emit a value to this event
  emit(value: A): void {
    console.log(`Emitting value:`, value);
    this.subscribers.forEach((sub) => {
      try {
        sub(value);
      } catch (error) {
        console.error("Error in subscriber:", error);
      }
    });
  }

  // Subscribe to this event
  subscribe(handler: (value: A) => void): () => void {
    this.subscribers.push(handler);
    return () => {
      const index = this.subscribers.indexOf(handler);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  // Map this event
  map<B>(f: (a: A) => B): Event<B> {
    const result = new Event<B>();

    // Create subscription
    const unsubscribe = this.subscribe((a) => {
      try {
        result.emit(f(a));
      } catch (error) {
        console.error("Error in map function:", error);
      }
    });

    return result;
  }
}
