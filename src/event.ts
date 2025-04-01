import { Reactive } from "./reactive";

// Event class with cleanup support
export class Event<A> {
    // List of subscribers
    private subscribers: Array<(value: A) => void> = [];

    // List of cleanup functions
    private cleanupFunctions: Array<() => void> = [];

    // Create a new event
    constructor() {}

    // Static factory for never events
    static never<A>(): Event<A> {
        const event = new Event<A>();
        event.isNever = () => true;
        return event;
    }

    // Emit a value to this event (for internal use)
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

    // Add a cleanup function
    addCleanup(cleanup: () => void): void {
        this.cleanupFunctions.push(cleanup);
    }

    // Clean up all resources
    cleanup(): void {
        // Run all cleanup functions
        this.cleanupFunctions.forEach((cleanup) => {
            try {
                cleanup();
            } catch (error) {
                console.error("Error in cleanup function:", error);
            }
        });

        // Clear arrays
        this.cleanupFunctions = [];
        this.subscribers = [];
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

    // Check if this is a never event
    isNever(): boolean {
        return false;
    }

    // Map this event
    map<B>(f: (a: A) => B): Event<B> {
        const result = new Event<B>();

        // Create subscription and add it to cleanup
        const unsubscribe = this.subscribe((a) => {
            try {
                result.emit(f(a));
            } catch (error) {
                console.error("Error in map function:", error);
            }
        });

        // Add cleanup for this subscription
        result.addCleanup(unsubscribe);

        return result;
    }

    // Merge with another event
    merge(other: Event<A>): Event<A> {
        const result = new Event<A>();

        // Create subscriptions and add them to cleanup
        const unsubscribe1 = this.subscribe((a) => result.emit(a));
        const unsubscribe2 = other.subscribe((a) => result.emit(a));

        // Add cleanups
        result.addCleanup(unsubscribe1);
        result.addCleanup(unsubscribe2);

        return result;
    }

    // In Event class
    flatMap<B>(f: (a: A) => Event<B>): Event<B> {
        const result = new Event<B>();
        let currentInnerEvent: Event<B> | null = null;
        let currentSubscription: (() => void) | null = null;

        const outerSubscription = this.subscribe((a) => {
            try {
                // Clean up previous inner resources
                if (currentSubscription) {
                    currentSubscription();
                    currentSubscription = null;
                }

                if (currentInnerEvent) {
                    currentInnerEvent.cleanup(); // Call cleanup on the event itself
                    currentInnerEvent = null;
                }

                // Create inner event
                currentInnerEvent = f(a);

                // Subscribe to inner event
                currentSubscription = currentInnerEvent.subscribe((b) =>
                    result.emit(b),
                );
            } catch (error) {
                console.error("Error in flatMap function:", error);
            }
        });

        // Add cleanup for outer subscription and current inner event
        result.addCleanup(() => {
            outerSubscription();
            if (currentSubscription) {
                currentSubscription();
            }
            if (currentInnerEvent) {
                currentInnerEvent.cleanup();
            }
        });

        return result;
    }

    // Filter this event
    filter(predicate: (a: A) => boolean): Event<A> {
        const result = new Event<A>();

        const unsubscribe = this.subscribe((a) => {
            if (predicate(a)) {
                result.emit(a);
            }
        });

        result.addCleanup(unsubscribe);

        return result;
    }

    // Accumulate values
    accumulate<B>(initial: B, f: (b: B, a: A) => B): Reactive<B> {
        const result = new Event<B>();
        let acc = initial;

        const unsubscribe = this.subscribe((a) => {
            try {
                acc = f(acc, a);
                result.emit(acc);
            } catch (error) {
                console.error("Error in accum function:", error);
            }
        });

        // Add cleanup to the result event
        result.addCleanup(unsubscribe);

        // Create and return reactive
        const reactive = new Reactive(initial, result);
        return reactive;
    }

    // Create a new event with emit function
    static create<A>(): [Event<A>, (value: A) => void] {
        const event = new Event<A>();
        return [event, (value: A) => event.emit(value)];
    }
}
