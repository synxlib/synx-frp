import { Event } from "./event";

// Future represents a computation that will be applied to subscribers
export class Future<A> {
  // The computation function
  private readonly computation: (handler: (value: A) => void) => () => void;

  /**
   * Create a new Future with the given computation
   */
  constructor(computation: (handler: (value: A) => void) => () => void) {
    this.computation = computation;
  }

  /**
   * Run this future with a specific handler
   */
  run(handler: (value: A) => void): () => void {
    return this.computation(handler);
  }

  /**
   * Map a function over this future
   */
  map<B>(f: (a: A) => B): Future<B> {
    return new Future<B>((handler) =>
      this.computation((a) => {
        try {
          handler(f(a));
        } catch (error) {
          console.error("Error in map function:", error);
        }
      }),
    );
  }

  /**
   * Create a never future that doesn't produce values
   */
  static never<A>(): Future<A> {
    return new Future<A>(() => () => {
      /* no-op */
    });
  }

  /**
   * Create a future from a reactive value's changes (Only for internal use by Reactive and Event)
   * @internal
   */
  static fromReactive<A>(reactive: InternalReactive<A>): Future<A> {
    return new Future<A>((handler) =>
      reactive.subscribeInternal(handler, false),
    );
  }
}
