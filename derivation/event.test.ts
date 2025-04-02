import { describe, test, expect, vi, beforeEach } from "vitest";
// import { Event } from "./event-computation";
// import { Event } from "./4-event-reactive-future";
import { Event } from "./5-event-future-reactive";

describe("Event", () => {
  describe("map", () => {
    test("should transform values", () => {
      // Create source event and emitter
      const [sourceEvent, emit] = Event.create<number>(0);

      // Map the event to double the values
      const doubledEvent = sourceEvent.map((x) => x * 2);

      // Create a mock subscriber
      const subscriber = vi.fn();

      // Subscribe to the mapped event
      doubledEvent.subscribe(subscriber);

      // Emit some values
      emit(1);
      emit(2);
      emit(5);

      // Check the subscriber was called with transformed values
      expect(subscriber).toHaveBeenCalledTimes(3);
      expect(subscriber).toHaveBeenNthCalledWith(1, 2);
      expect(subscriber).toHaveBeenNthCalledWith(2, 4);
      expect(subscriber).toHaveBeenNthCalledWith(3, 10);
    });

    test("should handle errors in mapping function", () => {
      // Create source event and emitter
      const [sourceEvent, emit] = Event.create<number>(0);

      // Mock console.error
      const originalConsoleError = console.error;
      console.error = vi.fn();

      // Create a map that throws on specific values
      const errorEvent = sourceEvent.map((x) => {
        if (x === 3) throw new Error("Test error");
        return x * 2;
      });

      // Create a mock subscriber
      const subscriber = vi.fn();

      // Subscribe to the mapped event
      errorEvent.subscribe(subscriber);

      // Emit values including one that causes an error
      emit(1);
      emit(3); // This should cause an error
      emit(5);

      // Restore console.error
      console.error = originalConsoleError;

      // Check the subscriber was called only for non-error values
      expect(subscriber).toHaveBeenCalledTimes(2);
      expect(subscriber).toHaveBeenNthCalledWith(1, 2);
      expect(subscriber).toHaveBeenNthCalledWith(2, 10);
    });

    test("should handle multiple subscribers", () => {
      // Create source event and emitter
      const [sourceEvent, emit] = Event.create<number>(0);

      // Map the event
      const doubledEvent = sourceEvent.map((x) => x * 2);

      // Create mock subscribers
      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();

      // Subscribe both to the mapped event
      doubledEvent.subscribe(subscriber1);
      doubledEvent.subscribe(subscriber2);

      // Emit a value
      emit(7);

      // Check both subscribers were called
      expect(subscriber1).toHaveBeenCalledWith(14);
      expect(subscriber2).toHaveBeenCalledWith(14);
    });

    test("should handle unsubscribe", () => {
      // Create source event and emitter
      const [sourceEvent, emit] = Event.create<number>(0);

      // Map the event
      const doubledEvent = sourceEvent.map((x) => x * 2);

      // Create a mock subscriber
      const subscriber = vi.fn();

      // Subscribe and store the unsubscribe function
      const unsubscribe = doubledEvent.subscribe(subscriber);

      // Emit initial value
      emit(5);

      // Unsubscribe
      unsubscribe();

      // Emit more values
      emit(10);
      emit(15);

      // Check the subscriber was only called once (before unsubscribe)
      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber).toHaveBeenCalledWith(10);
    });

    test("should handle chain of multiple maps", () => {
      // Create source event and emitter
      const [sourceEvent, emit] = Event.create<number>(0);

      // Create a chain of mapped events
      const doubledEvent = sourceEvent.map((x) => x * 2);
      const addedEvent = doubledEvent.map((x) => x + 10);
      const finalEvent = addedEvent.map((x) => `Result: ${x}`);

      // Create a mock subscriber for the final result
      const finalSubscriber = vi.fn();

      // Subscribe to the end of the chain
      finalEvent.subscribe(finalSubscriber);

      // Emit values
      emit(5);
      emit(10);

      // Check subscriber received correct transformed values
      expect(finalSubscriber).toHaveBeenCalledTimes(2);
      expect(finalSubscriber).toHaveBeenNthCalledWith(1, "Result: 20");
      expect(finalSubscriber).toHaveBeenNthCalledWith(2, "Result: 30");
    });
  });
});
