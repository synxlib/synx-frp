import { Future } from "./1-future";
import { Reactive } from "./2-reactive";
import { InternalReactive, ReactiveImpl } from "./2-reactive";

/**
 * Public interface for Events
 */
export interface Event<A> {
  /**
   * Subscribe to this event
   */
  subscribe(handler: (value: A) => void): () => void;

  /**
   * Map this event
   */
  map<B>(f: (a: A) => B): Event<B>;

  /**
   * Create a reactive value from this event
   */
  stepper(initialValue: A): Reactive<A>;
}

/**
 * Internal interface that extends Event with methods only for Reactive to use
 */
interface InternalEvent<A> extends Event<A> {
  /**
   * Get the future (only for Reactive to call)
   * @internal
   */
  getFutureInternal(): Future<A>;
}

/**
 * Concrete implementation of Event
 * It's conceptually: newtype Event a = Ev(Future (Reactive a))
 */
export class EventImpl<A> implements InternalEvent<A> {
  // The underlying future of values
  private future: Future<A>;

  // For source events, we keep track of the reactive value
  private sourceReactive?: InternalReactive<A>;

  // Cached stepper reactive
  private stepperReactive?: Reactive<A>;
  private stepperInitialValue?: A;

  /**
   * Create a new event
   */
  constructor(future: Future<A>, sourceReactive?: InternalReactive<A>) {
    this.future = future;
    this.sourceReactive = sourceReactive;
  }

  /**
   * Internal method to get the future
   * @internal
   */
  getFutureInternal(): Future<A> {
    return this.future;
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
    return new EventImpl<B>(this.future.map(f));
  }

  /**
   * Create a reactive value from this event
   * @param initialValue The initial value for the reactive
   */
  stepper(initialValue: A): Reactive<A> {
    // If we already created a stepper with this initial value, return the cached one
    if (this.stepperReactive && this.stepperInitialValue === initialValue) {
      return this.stepperReactive;
    }

    // Create a new reactive
    const reactive = new ReactiveImpl<A>(initialValue, this);

    // Cache it for future calls
    this.stepperReactive = reactive;
    this.stepperInitialValue = initialValue;

    return reactive;
  }
}

/**
 * Factory functions for creating Events and Reactives
 */
export const Event = {
  /**
   * Create an event with an emitter function
   */
  create<A>(initialValue: A): [Event<A>, (value: A) => void] {
    // Create a reactive value to store state
    const reactive = new ReactiveImpl<A>(initialValue);

    // Create a future from the reactive
    const future = Future.fromReactive(reactive);

    // Create the event with both
    const event = new EventImpl<A>(future, reactive);

    // Create the emit function that updates the reactive
    const emit = (value: A): void => {
      console.log(`Emitting value:`, value);
      reactive.updateValueInternal(value);
    };

    return [event, emit];
  },

  /**
   * Create a never event
   */
  never<A>(): Event<A> {
    return new EventImpl<A>(Future.never<A>());
  },
};
