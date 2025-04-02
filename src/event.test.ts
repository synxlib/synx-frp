import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Event, EventImpl } from './event'; // Adjust the import path as needed
import { Future } from './future'; // Adjust the import path as needed

describe('Event Functor Laws', () => {
  // Helper function to create an event and trigger it with a value
  function createTestEvent<A>(initialValue: A): [EventImpl<A>, (value: A) => void] {
    const [event, emit] = Event.create(initialValue);
    return [event as EventImpl<A>, emit];
  }

  // Helper function to collect event values
  function collectValues<A>(event: Event<A>): { values: A[], unsubscribe: () => void } {
    const values: A[] = [];
    const unsubscribe = event.subscribe(value => {
      values.push(value);
    });
    return { values, unsubscribe };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Identity Law: map(id) === id', () => {
    it('should maintain identity when mapping with identity function', () => {
      // Create an event
      const [event, emit] = createTestEvent(0);
      
      // Apply identity function through map
      const mappedEvent = event.map(x => x);
      
      // Collect values from both events
      const original = collectValues(event);
      const mapped = collectValues(mappedEvent);
      
      // Emit some values
      emit(1);
      emit(42);
      emit(100);
      
      // Verify both events received the same values
      expect(mapped.values).toEqual(original.values);
      
      // Clean up
      original.unsubscribe();
      mapped.unsubscribe();
      event.cleanup();
      mappedEvent.cleanup();
    });
  });

  describe('Composition Law: map(f . g) === map(f) . map(g)', () => {
    it('should compose functions correctly', () => {
      // Create an event
      const [event, emit] = createTestEvent(0);
      
      // Define two functions to compose
      const f = (x: number) => x * 2;
      const g = (x: number) => x + 5;
      const composed = (x: number) => f(g(x)); // (x + 5) * 2
      
      // Map with composed function
      const composedMap = event.map(composed);
      
      // Map with separate functions
      const separateMap = event.map(g).map(f);
      
      // Collect results from both approaches
      const composedResults = collectValues(composedMap);
      const separateResults = collectValues(separateMap);
      
      // Emit values
      emit(1);  // Should result in (1 + 5) * 2 = 12
      emit(10); // Should result in (10 + 5) * 2 = 30
      emit(-3); // Should result in (-3 + 5) * 2 = 4
      
      // Verify both mapping approaches yield the same results
      expect(composedResults.values).toEqual(separateResults.values);
      expect(composedResults.values).toEqual([12, 30, 4]);
      
      // Clean up
      composedResults.unsubscribe();
      separateResults.unsubscribe();
      event.cleanup();
      composedMap.cleanup();
      separateMap.cleanup();
    });
  });

  describe('Functor behavior with different data types', () => {
    it('should correctly map string events', () => {
      const [event, emit] = createTestEvent('');
      
      const mappedEvent = event.map(str => str.toUpperCase());
      const results = collectValues(mappedEvent);
      
      emit('hello');
      emit('world');
      
      expect(results.values).toEqual(['HELLO', 'WORLD']);
      
      results.unsubscribe();
      event.cleanup();
      mappedEvent.cleanup();
    });

    it('should correctly map object events', () => {
      const [event, emit] = createTestEvent({ count: 0 });
      
      const mappedEvent = event.map(obj => ({ count: obj.count + 1 }));
      const results = collectValues(mappedEvent);
      
      emit({ count: 5 });
      emit({ count: 10 });
      
      expect(results.values).toEqual([{ count: 6 }, { count: 11 }]);
      
      results.unsubscribe();
      event.cleanup();
      mappedEvent.cleanup();
    });
  });

  describe('Edge cases', () => {
    it('should handle nested mapping correctly', () => {
      const [event, emit] = createTestEvent(1);
      
      // Create a deeply nested map chain
      const deeplyMapped = event
        .map(x => x + 1)
        .map(x => x * 2)
        .map(x => x.toString())
        .map(x => parseInt(x))
        .map(x => x - 1);
      
      const results = collectValues(deeplyMapped);
      
      emit(5);  // ((5 + 1) * 2) - 1 = 11
      
      expect(results.values).toEqual([11]);
      
      results.unsubscribe();
      event.cleanup();
      deeplyMapped.cleanup();
    });

    it('should handle null/undefined values correctly', () => {
      const [event, emit] = createTestEvent<number | null | undefined>(0);
      
      const mappedEvent = event.map(x => x === null || x === undefined ? -1 : x * 2);
      const results = collectValues(mappedEvent);
      
      emit(5);
      emit(null);
      emit(undefined);
      emit(10);
      
      expect(results.values).toEqual([10, -1, -1, 20]);
      
      results.unsubscribe();
      event.cleanup();
      mappedEvent.cleanup();
    });
  });

  describe('Performance considerations', () => {
    it('should not invoke mapping function unnecessarily', () => {
      const [event, emit] = createTestEvent(0);
      
      const mapFn = vi.fn((x: number) => x * 2);
      const mappedEvent = event.map(mapFn);
      
      // Subscribe to mapped event
      const unsubscribe = mappedEvent.subscribe(() => {});
      
      // Emit values
      emit(1);
      emit(2);
      emit(3);
      
      // Function should be called exactly once per emission
      expect(mapFn).toHaveBeenCalledTimes(3);
      expect(mapFn).toHaveBeenNthCalledWith(1, 1);
      expect(mapFn).toHaveBeenNthCalledWith(2, 2);
      expect(mapFn).toHaveBeenNthCalledWith(3, 3);
      
      unsubscribe();
      event.cleanup();
      mappedEvent.cleanup();
    });
  });
});