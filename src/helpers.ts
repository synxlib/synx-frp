import { Event } from "./event";

/**
 * Utility functions for working with FRP
 */

// Create an event from a DOM event source with cleanup
export function fromDOMEvent<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    eventName: K,
): Event<HTMLElementEventMap[K]> {
    const [event, emit] = Event.create<HTMLElementEventMap[K]>();

    // Create the event handler
    const handler = (e: HTMLElementEventMap[K]) => {
        console.log(`DOM event: ${eventName}`, e);
        emit(e);
    };

    // Add the event listener
    element.addEventListener(eventName, handler as EventListener);

    // Add cleanup to remove the event listener
    event.cleanup = () => {
        console.log(`Removing ${eventName} listener from`, element);
        element.removeEventListener(eventName, handler as EventListener);
    };

    return event;
}

// Create a timer event that fires periodically
export function interval(period: number): Event<number> {
    const [input, emit] = Event.create<number>();
    let count = 0;
    let id: ReturnType<typeof setTimeout> | null = null;

    (function loop() {
        emit(count++);
        id = setTimeout(loop, period);
    })();

    input.cleanup = () => {
        if (id) clearTimeout(id);
    };

    return input;
}
