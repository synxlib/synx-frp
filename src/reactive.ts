import { Event } from "./event";

export class Reactive<A> {
    // The current value
    private currentValue: A;
    private changeEvent: Event<A>;
    private subscribers: Array<(value: A) => void> = [];

    constructor(initialValue: A, changes: Event<A>) {
        this.currentValue = initialValue;
        this.changeEvent = changes;

        // Subscribe to changes to update the current value
        this.changeEvent.subscribe((newValue) => {
            this.updateValue(newValue);
        });
    }

    // Sample the current value
    sample(): A {
        return this.currentValue;
    }

    // Get the event of changes
    changes(): Event<A> {
        return this.changeEvent;
    }

    // Subscribe to value changes
    subscribe(handler: (value: A) => void): () => void {
        this.subscribers.push(handler);

        // Call immediately with current value
        handler(this.currentValue);

        // Return unsubscribe function
        return () => {
            this.subscribers = this.subscribers.filter((h) => h !== handler);
        };
    }

    // Update the value and notify subscribers
    private updateValue(newValue: A): void {
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

    // Functor instance
    map<B>(f: (a: A) => B): Reactive<B> {
        return new Reactive<B>(f(this.currentValue), this.changeEvent.map(f));
    }

    // Apply a function-valued reactive
    apply<B>(rf: Reactive<(a: A) => B>): Reactive<B> {
        // Initial value is current function applied to current value
        const initialResult = rf.sample()(this.sample());

        // Changes happen when either the function or argument changes
        const functionChanges = rf.changes().map((f) => f(this.sample()));
        const argumentChanges = this.changes().map((a) => rf.sample()(a));

        return new Reactive<B>(
            initialResult,
            functionChanges.merge(argumentChanges),
        );
    }

    flatMap<B>(f: (a: A) => Reactive<B>): Reactive<B> {
        // Apply f to the current value to get the initial result
        const initialResult = f(this.currentValue);

        // Create a new reactive with the initial mapped value
        const result = new Reactive<B>(
            initialResult.sample(),
            Event.never<B>(),
        );

        // Set up subscriptions to handle changes

        // 1. When this reactive changes, apply f to the new value
        this.subscribe((newA) => {
            const newB = f(newA);
            result.updateValue(newB.sample());

            // Also subscribe to changes in the new reactive
            newB.subscribe((b) => {
                result.updateValue(b);
            });
        });

        // 2. Also watch for changes in the initial result
        initialResult.subscribe((b) => {
            result.updateValue(b);
        });

        return result;
    }

    // Static helper for creating constant reactives
    static constant<A>(value: A): Reactive<A> {
        return new Reactive<A>(value, Event.never<A>());
    }
}
