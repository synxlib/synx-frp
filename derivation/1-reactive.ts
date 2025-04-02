import { Future } from "./1-future";

/**
 * Reactive value represents a value that can change over time
 * with notification to subscribers
 */
export class Reactive<A> {
  private value: A | undefined;
  private subscribers: Array<(value: A) => void> = [];
  private hasValue: boolean = false;

  /**
   * Create a new reactive value
   * @param initialValue Optional initial value
   */
  constructor(initialValue?: A) {
    if (initialValue !== undefined) {
      this.value = initialValue;
      this.hasValue = true;
    }
  }

  /**
   * Set a new value and notify subscribers
   */
  set(newValue: A): void {
    this.value = newValue;
    this.hasValue = true;

    // Notify subscribers
    this.subscribers.forEach((sub) => {
      try {
        sub(newValue);
      } catch (error) {
        console.error("Error in subscriber:", error);
      }
    });
  }

  /**
   * Get the current value
   * @throws Error if no value has been set
   */
  get(): A {
    if (!this.hasValue) {
      throw new Error("No value has been set");
    }
    return this.value as A;
  }

  /**
   * Check if this reactive has a value
   */
  hasAValue(): boolean {
    return this.hasValue;
  }

  /**
   * Subscribe to changes
   * @param handler Function to call when value changes
   * @param notifyImmediately Whether to call the handler with current value immediately
   */
  subscribe(
    handler: (value: A) => void,
    notifyImmediately: boolean = false,
  ): () => void {
    // Add to subscribers
    this.subscribers.push(handler);

    // Notify immediately if requested and we have a value
    if (notifyImmediately && this.hasValue) {
      handler(this.value as A);
    }

    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(handler);
      if (index >= 0) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Create a future that represents this reactive's changes
   */
  changes(): Future<A> {
    return new Future<A>((handler) => this.subscribe(handler));
  }
}
