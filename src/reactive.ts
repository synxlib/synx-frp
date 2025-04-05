import { Event, EventImpl } from "./event";
import { Future } from "./future";

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

    /**
     * Apply a function-valued reactive to this reactive
     */
    ap<B>(rf: Reactive<(a: A) => B>): Reactive<B>;

    /**
     * Chain/flatMap this reactive with a function that returns another reactive
     */
    chain<B>(f: (a: A) => Reactive<B>): Reactive<B>;

    /**
     * Clean up resources
     */
    cleanup(): void;
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
        notifyWithCurrent: boolean
    ): () => void;
}

/**
 * Reactive value represents a value that can change over time
 * It's conceptually: data Reactive a = a `Stepper` Event a
 */
export class ReactiveImpl<A> implements InternalReactive<A> {
    private currentValue: A;
    private changeEvent?: Event<A>;
    private subscribers: Array<(value: A) => void> = [];
    private eventUnsubscribe?: () => void;

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
            this.eventUnsubscribe = changeEvent.subscribe((newValue) => {
                this.updateValueInternal(newValue);
            });
        }
    }

    /**
     * Clean up resources
     */
    cleanup(): void {
        // Unsubscribe from the change event if we have one
        if (this.eventUnsubscribe) {
            this.eventUnsubscribe();
            this.eventUnsubscribe = undefined;
        }

        // Clear subscribers
        this.subscribers = [];
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
            const future = Future.fromReactive<A>(this);

            // Create an event with this future
            this.changeEvent = new EventImpl<A>(future);
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
        notifyWithCurrent: boolean
    ): () => void {
        this.subscribers.push(handler);

        // Call immediately with current value if requested
        if (notifyWithCurrent) {
            handler(this.currentValue);
        }

        // Return unsubscribe function
        return () => {
            this.subscribers = this.subscribers.filter(
                (sub) => sub !== handler
            );
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
        const mappedEvent = this.changeEvent
            ? this.changeEvent.map(f)
            : undefined;

        return new ReactiveImpl<B>(initialValue, mappedEvent);
    }

    /**
     * Apply a function-valued reactive to this reactive
     */
    ap<B>(rf: Reactive<(a: A) => B>): Reactive<B> {
        // Get current function and apply it to current value
        const currentFn = rf.get();
        const initialValue = currentFn(this.currentValue);

        // Create a new reactive
        const result = new ReactiveImpl<B>(initialValue);

        // Setup subscriptions to update when either reactive changes

        // When this reactive changes, apply latest function to new value
        const sub1 = this.subscribe((a) => {
            const fn = rf.get(); // Get current function
            result.updateValueInternal(fn(a));
        });

        // When function reactive changes, apply new function to latest value
        const sub2 = rf.subscribe((fn) => {
            result.updateValueInternal(fn(this.currentValue));
        });

        // Store unsubscribe functions for cleanup
        const originalCleanup = result.cleanup.bind(result);
        result.cleanup = () => {
            sub1();
            sub2();
            originalCleanup();
        };

        return result;
    }

    /**
     * Chain/flatMap this reactive with a function that returns another reactive
     */
    chain<B>(f: (a: A) => Reactive<B>): Reactive<B> {
        // Apply f to the current value to get the initial result
        const initialResult = f(this.currentValue);
        const initialValue = initialResult.get();

        // Create a new reactive with the initial value
        const result = new ReactiveImpl<B>(initialValue);

        // Set up subscription to this reactive
        const sub = this.subscribe((a) => {
            // When this reactive changes, apply f to get a new reactive
            const newResult = f(a);
            // Update our result with the current value from the new reactive
            result.updateValueInternal(newResult.get());

            // Also subscribe to changes from the new reactive
            const innerSub = newResult.subscribe((b) => {
                result.updateValueInternal(b);
            });

            // Store the inner subscription for cleanup (will be overwritten on next change)
            // This is a simplified approach; a more robust implementation would track and
            // clean up all inner subscriptions
            if (result.cleanup) {
                const originalCleanup = result.cleanup.bind(result);
                result.cleanup = () => {
                    innerSub();
                    originalCleanup();
                };
            }
        });

        // Store unsubscribe function for cleanup
        const originalCleanup = result.cleanup.bind(result);
        result.cleanup = () => {
            sub();
            originalCleanup();
        };

        return result;
    }
}

/**
 * Factory functions for creating Reactives
 */
export const Reactive = {
    /**
     * Create a constant reactive value
     */
    of<A>(value: A): Reactive<A> {
        return new ReactiveImpl<A>(value);
    },

    accum<A>(initialValue: A, event: Event<(a: A) => A>): Reactive<A> {
        return Event.accum(initialValue, event).stepper(initialValue);
    }
};
