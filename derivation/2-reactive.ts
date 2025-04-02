import { Future } from "./1-future";
import { Event, EventImpl } from "./5-event-future-reactive";

/**
 * Public interface for Reactive values
 */
export interface Reactive<A> {
  /**
   * Get the current value
   */
  get(): A;

  /**
   * Get the change event
   */
  changes(): Event<A>;

  /**
   * Subscribe to value changes
   */
  subscribe(handler: (value: A) => void): () => void;

  /**
   * Map a function over this reactive value
   */
  map<B>(f: (a: A) => B): Reactive<B>;
}

/**
 * Internal interface that extends Reactive with methods only for Event/Future to use
 */
export interface InternalReactive<A> extends Reactive<A> {
  /**
   * Update the value and notify subscribers (only for Event to call)
   * @internal
   */
  updateValueInternal(newValue: A): void;

  /**
   * Subscribe to changes with control over immediate notification (only for Future to call)
   * @internal
   */
  subscribeInternal(
    handler: (value: A) => void,
    notifyWithCurrent: boolean,
  ): () => void;
}

/**
 * Concrete implementation of Reactive
 * It's conceptually: data Reactive a = a `Stepper` Event a
 */
export class ReactiveImpl<A> implements InternalReactive<A> {
  private currentValue: A;
  private changeEvent?: Event<A>;
  private subscribers: Array<(value: A) => void> = [];

  /**
   * Create a new reactive value
   * @param initialValue The initial value
   * @param changeEvent Optional event that triggers changes
   */
  constructor(initialValue: A, changeEvent?: Event<A>) {
    this.currentValue = initialValue;
    this.changeEvent = changeEvent;

    // If event is provided, subscribe to it
    if (changeEvent) {
      changeEvent.subscribe((newValue) => {
        this.updateValueInternal(newValue);
      });
    }
  }

  /**
   * Get the current value
   */
  get(): A {
    return this.currentValue;
  }

  /**
   * Get the change event
   */
  changes(): Event<A> {
    if (!this.changeEvent) {
      // Create a self-referential relationship:
      // Create a future based on this reactive's updates
      const future = Future.fromReactive(this);

      // Create an event with this future
      this.changeEvent = new EventImpl<A>(future, this);
    }

    return this.changeEvent;
  }

  /**
   * Subscribe to value changes
   */
  subscribe(handler: (value: A) => void): () => void {
    return this.subscribeInternal(handler, true);
  }

  /**
   * Internal method to subscribe to changes with control over immediate notification
   * @internal
   */
  subscribeInternal(
    handler: (value: A) => void,
    notifyWithCurrent: boolean,
  ): () => void {
    this.subscribers.push(handler);

    // Call immediately with current value if requested
    if (notifyWithCurrent) {
      handler(this.currentValue);
    }

    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter((sub) => sub !== handler);
    };
  }

  /**
   * Internal method to update the value and notify subscribers
   * @internal
   */
  updateValueInternal(newValue: A): void {
    this.currentValue = newValue;

    // Notify subscribers
    this.subscribers.forEach((sub) => {
      try {
        sub(newValue);
      } catch (error) {
        console.error("Error in reactive subscriber:", error);
      }
    });
  }

  /**
   * Map a function over this reactive value
   */
  map<B>(f: (a: A) => B): Reactive<B> {
    // Apply function to current value
    const initialValue = f(this.currentValue);

    // Map the change event if it exists
    const mappedEvent = this.changeEvent ? this.changeEvent.map(f) : undefined;

    return new ReactiveImpl<B>(initialValue, mappedEvent);
  }
}
