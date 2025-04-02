import { Future } from "./future";
import { InternalReactive, Reactive, ReactiveImpl } from "./reactive";

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

    /**
     * Merge this event with another event
     */
    concat(other: Event<A>): Event<A>;

    /**
     * Apply a function event to this event
     */
    ap<B>(ef: Event<(a: A) => B>): Event<B>;

    /**
     * Chain/flatMap this event with a function that returns another event
     */
    chain<B>(f: (a: A) => Event<B>): Event<B>;

    /**
     * Filter this event based on a predicate
     */
    filter(predicate: (a: A) => boolean): Event<A>;

    /**
     * Fold/accumulate values from this event
     */
    fold<B>(initial: B, f: (b: B, a: A) => B): Reactive<B>;

    /**
     * Combine this event with another event into a paired event
     */
    zip<B>(other: Event<B>): Event<[A, B]>;

    /**
     * Clean up resources
     */
    cleanup(): void;
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

    // For source events, this reactive handles the subscriber management
    private sourceReactive?: InternalReactive<A>;

    // Cached stepper reactive
    private stepperReactive?: Reactive<A>;
    private stepperInitialValue?: A;

    // Tracking active subscriptions for cleanup
    private activeSubscriptions: Set<() => void> = new Set();

    /**
     * Create a new event
     * @param future The future that powers this event
     * @param sourceReactive Optional reactive value that handles subscribers for source events
     */
    constructor(future: Future<A>, sourceReactive?: InternalReactive<A>) {
        this.future = future;
        this.sourceReactive = sourceReactive;
    }

    /**
     * Clean up resources
     */
    cleanup(): void {
        // Unsubscribe all active subscriptions
        this.activeSubscriptions.forEach((unsub) => {
            try {
                unsub();
            } catch (error) {
                console.error("Error during unsubscribe:", error);
            }
        });
        this.activeSubscriptions.clear();

        // Clean up stepper reactive if we have one
        if (this.stepperReactive) {
            this.stepperReactive.cleanup();
            this.stepperReactive = undefined;
            this.stepperInitialValue = undefined;
        }
    }

    /**
     * Internal method to get the future
     * @internal
     */
    getFutureInternal(): Future<A> {
        return this.future;
    }

    /**
     * Emit a value to this event (only valid for source events)
     */
    emit(value: A): void {
        if (!this.sourceReactive) {
            throw new Error("Cannot emit on derived events");
        }

        console.log(`Emitting value:`, value);
        this.sourceReactive.updateValueInternal(value);
    }

    /**
     * Subscribe to this event
     */
    subscribe(handler: (value: A) => void): () => void {
        const unsubscribe = this.future.run(handler);

        // Track this subscription for cleanup
        this.activeSubscriptions.add(unsubscribe);

        // Return an unsubscribe function that also removes from our tracking
        return () => {
            unsubscribe();
            this.activeSubscriptions.delete(unsubscribe);
        };
    }

    /**
     * Map this event
     */
    map<B>(f: (a: A) => B): Event<B> {
        // When mapping, we create a derived event with no source reactive
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

    /**
     * Merge this event with another event
     */
    concat(other: Event<A>): Event<A> {
        // Create a future that subscribes to both events
        const future = new Future<A>((handler) => {
            // Subscribe to this event
            const sub1 = this.subscribe(handler);

            // Subscribe to the other event
            const sub2 = other.subscribe(handler);

            // Return a function that unsubscribes from both
            return () => {
                sub1();
                sub2();
            };
        });

        return new EventImpl<A>(future);
    }

    /**
     * Apply a function event to this event
     */
    ap<B>(ef: Event<(a: A) => B>): Event<B> {
        // We need to track the latest values from both events
        let latestFn: ((a: A) => B) | null = null;
        let latestValue: A | null = null;
        let hasValue = false;
        let hasFn = false;

        // Create a future that combines the two events
        const future = new Future<B>((handler) => {
            // Subscribe to the function event
            const fnSub = ef.subscribe((fn) => {
                latestFn = fn;
                hasFn = true;

                // If we already have a value, apply the function
                if (hasValue && latestValue !== null) {
                    try {
                        handler(fn(latestValue));
                    } catch (error) {
                        console.error("Error applying function in ap:", error);
                    }
                }
            });

            // Subscribe to this event (the value event)
            const valueSub = this.subscribe((value) => {
                latestValue = value;
                hasValue = true;

                // If we already have a function, apply it
                if (hasFn && latestFn !== null) {
                    try {
                        handler(latestFn(value));
                    } catch (error) {
                        console.error("Error applying function in ap:", error);
                    }
                }
            });

            // Return a function that unsubscribes from both
            return () => {
                fnSub();
                valueSub();
            };
        });

        return new EventImpl<B>(future);
    }

    /**
     * Chain/flatMap this event with a function that returns another event
     */
    chain<B>(f: (a: A) => Event<B>): Event<B> {
        // Create a future for the chained event
        const future = new Future<B>((handler) => {
            let currentInnerEvent: Event<B> | null = null;
            // Track current inner subscription so we can clean it up
            let currentInnerSub: (() => void) | null = null;

            // Subscribe to the outer event
            const outerSub = this.subscribe((a) => {
                // Clean up previous inner subscription
                if (currentInnerSub) {
                    currentInnerSub();
                    currentInnerSub = null;
                }

                if (currentInnerEvent) {
                    currentInnerEvent.cleanup();
                    currentInnerEvent = null;
                }

                // Create inner event from the value
                try {
                    currentInnerEvent = f(a);

                    // Subscribe to inner event
                    currentInnerSub = currentInnerEvent.subscribe(handler);
                } catch (error) {
                    console.error("Error in chain function:", error);
                }
            });

            // Return function that unsubscribes from both
            return () => {
                outerSub();
                if (currentInnerSub) {
                    currentInnerSub();
                }
                if (currentInnerEvent) {
                    currentInnerEvent.cleanup();
                }
            };
        });

        return new EventImpl<B>(future);
    }

    /**
     * Filter this event based on a predicate
     */
    filter(predicate: (a: A) => boolean): Event<A> {
        // Create a future that only passes through values that match the predicate
        const future = new Future<A>((handler) => {
            // Subscribe to this event
            return this.subscribe((a) => {
                try {
                    // Only call handler if predicate is true
                    if (predicate(a)) {
                        handler(a);
                    }
                } catch (error) {
                    console.error("Error in filter predicate:", error);
                }
            });
        });

        return new EventImpl<A>(future);
    }

    /**
     * Fold/accumulate values from this event
     */
    fold<B>(initial: B, f: (b: B, a: A) => B): Reactive<B> {
        // Create a reactive with the initial value
        const result = new ReactiveImpl<B>(initial);

        // Keep track of accumulated value
        let acc = initial;

        // Subscribe to this event
        const sub = this.subscribe((a) => {
            try {
                // Update accumulated value
                acc = f(acc, a);

                // Update reactive
                result.updateValueInternal(acc);
            } catch (error) {
                console.error("Error in fold function:", error);
            }
        });

        // Set up cleanup
        const originalCleanup = result.cleanup.bind(result);
        result.cleanup = () => {
            sub();
            originalCleanup();
        };

        return result;
    }

    /**
     * Combine this event with another event into a paired event
     */
    zip<B>(other: Event<B>): Event<[A, B]> {
        // Track the latest values
        let latestA: A | null = null;
        let hasA = false;
        let latestB: B | null = null;
        let hasB = false;

        // Create a future that produces pairs
        const future = new Future<[A, B]>((handler) => {
            // Subscribe to this event
            const subA = this.subscribe((a) => {
                latestA = a;
                hasA = true;

                // If we have a value from the other event, emit a pair
                if (hasB && latestB !== null) {
                    handler([a, latestB]);
                }
            });

            // Subscribe to the other event
            const subB = other.subscribe((b) => {
                latestB = b;
                hasB = true;

                // If we have a value from this event, emit a pair
                if (hasA && latestA !== null) {
                    handler([latestA, b]);
                }
            });

            // Return function that unsubscribes from both
            return () => {
                subA();
                subB();
            };
        });

        return new EventImpl<[A, B]>(future);
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
        const future = Future.fromReactive<A>(reactive);

        // Create the event with both
        const event = new EventImpl<A>(future, reactive);

        // Create the emit function that uses the event's internal emit method
        const emit = (value: A): void => {
            reactive.updateValueInternal(value);
        };

        return [event, emit];
    },

    /**
     * Create a never/empty event
     */
    never<A>(): Event<A> {
        return new EventImpl<A>(Future.never<A>());
    },

    /**
     * Alias for never
     */
    empty<A>(): Event<A> {
        return Event.never<A>();
    },

    /**
     * Join/flatten an event of events
     */
    join<A>(eventOfEvents: Event<Event<A>>): Event<A> {
        return eventOfEvents.chain((event) => event);
    },

    /**
     * Combine multiple events into a tuple
     */
    zip<A, B>(eventA: Event<A>, eventB: Event<B>): Event<[A, B]> {
        return eventA.zip(eventB);
    },

    /**
     * Combine multiple events into a tuple
     */
    zipAll<T extends any[]>(
        ...events: { [K in keyof T]: Event<T[K]> }
    ): Event<T> {
        if (events.length === 0) {
            throw new Error("zipAll requires at least one event");
        }

        if (events.length === 1) {
            // If only one event, map it to create a singleton tuple
            return events[0].map((value) => [value] as unknown as T);
        }

        // Start with first two events
        let result = Event.zip(events[0], events[1]).map(
            ([a, b]) => [a, b] as unknown as T
        );

        // Combine with remaining events
        for (let i = 2; i < events.length; i++) {
            result = result.zip(events[i]).map(([tuple, next]) => {
                // Create a new tuple with all previous values plus the new one
                return [...(tuple as any[]), next] as unknown as T;
            });
        }

        return result;
    },
};
