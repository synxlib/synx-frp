import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Event, EventImpl } from "./event";
import { Reactive } from "./reactive";

describe("Event", () => {
    // Helper function to create an event and trigger it with a value
    function createTestEvent<A>(): [EventImpl<A>, (value: A) => void] {
        const [event, emit] = Event.create();
        return [event as EventImpl<A>, emit];
    }

    // Helper function to collect event values
    function collectValues<A>(event: Event<A>): {
        values: A[];
        unsubscribe: () => void;
    } {
        const values: A[] = [];
        console.log("Collect values subscribe");
        const unsubscribe = event.subscribe((value) => {
            values.push(value);
        });
        return { values, unsubscribe };
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("Event Functor Laws", () => {
        describe("Identity Law: map(id) === id", () => {
            it("should maintain identity when mapping with identity function", () => {
                // Create an event
                const [event, emit] = createTestEvent();

                // Apply identity function through map
                const mappedEvent = event.map((x) => x);

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

        describe("Composition Law: map(f . g) === map(f) . map(g)", () => {
            it("should compose functions correctly", () => {
                // Create an event
                const [event, emit] = createTestEvent<number>();

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
                emit(1); // Should result in (1 + 5) * 2 = 12
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

        describe("Functor behavior with different data types", () => {
            it("should correctly map string events", () => {
                const [event, emit] = createTestEvent<string>();

                const mappedEvent = event.map((str) => str.toUpperCase());
                const results = collectValues(mappedEvent);

                emit("hello");
                emit("world");

                expect(results.values).toEqual(["HELLO", "WORLD"]);

                results.unsubscribe();
                event.cleanup();
                mappedEvent.cleanup();
            });

            it("should correctly map object events", () => {
                const [event, emit] = createTestEvent<{ count: number }>();

                const mappedEvent = event.map((obj) => ({
                    count: obj.count + 1,
                }));
                const results = collectValues(mappedEvent);

                emit({ count: 5 });
                emit({ count: 10 });

                expect(results.values).toEqual([{ count: 6 }, { count: 11 }]);

                results.unsubscribe();
                event.cleanup();
                mappedEvent.cleanup();
            });
        });

        describe("Edge cases", () => {
            it("should handle nested mapping correctly", () => {
                const [event, emit] = createTestEvent<number>();

                // Create a deeply nested map chain
                const deeplyMapped = event
                    .map((x) => x + 1)
                    .map((x) => x * 2)
                    .map((x) => x.toString())
                    .map((x) => parseInt(x))
                    .map((x) => x - 1);

                const results = collectValues(deeplyMapped);

                emit(5); // ((5 + 1) * 2) - 1 = 11

                expect(results.values).toEqual([11]);

                results.unsubscribe();
                event.cleanup();
                deeplyMapped.cleanup();
            });

            it("should handle null/undefined values correctly", () => {
                const [event, emit] = createTestEvent<
                    number | null | undefined
                >();

                const mappedEvent = event.map((x) =>
                    x === null || x === undefined ? -1 : x * 2
                );
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

        describe("Performance considerations", () => {
            it("should not invoke mapping function unnecessarily", () => {
                const [event, emit] = createTestEvent<number>();

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

    describe("Event apply function", () => {
        it("should apply reactive function to the event", () => {
            const reactiveFn = Reactive.of((x: number) => x * 2);
            const [event, emit] = createTestEvent<number>();

            const output = collectValues(event.apply(reactiveFn));

            emit(2);
            emit(3);
            emit(4);

            expect(output.values).toEqual([4, 6, 8]);
        });

        it("should apply updated function to the event", () => {
            const [event, emit] = createTestEvent<number>();
            const [multiplier, emitMultiplier] = createTestEvent<number>();

            const reactiveFn = multiplier.stepper(2).map((m) => (x: number) => x * m);

            const output = collectValues(event.apply(reactiveFn));

            emit(2);
            emitMultiplier(3)
            emit(3);
            emitMultiplier(4)
            emit(4);

            expect(output.values).toEqual([4, 9, 16]);
        });
    });

    /*
    describe("ap method (Applicative Functor)", () => {
        it("should apply function event to value event", () => {
            // Create a value event and a function event
            const [valueEvent, emitValue] = createTestEvent<number>();
            const [fnEvent, emitFn] = createTestEvent<(x: number) => number>();

            // Apply function event to value event
            const appliedEvent = valueEvent.ap(fnEvent);

            // Collect results
            const results = collectValues(appliedEvent);

            // Emit values and functions
            emitFn((x) => x * 2); // Should result in 5 * 2 = 10

            emitValue(7); // Should result in 7 * 2 = 14

            emitFn((x) => x + 3); // Should result in 7 + 3 = 10

            emitValue(1); // Should result in 1 + 3 = 4

            expect(results.values).toEqual([14, 10, 4]);

            // Clean up
            results.unsubscribe();
            valueEvent.cleanup();
            fnEvent.cleanup();
            appliedEvent.cleanup();
        });

        // Applicative identity law: pure id <*> v = v
        it("should satisfy the identity law", () => {
            const [event, emit] = createTestEvent<number>();

            // Create an event with the identity function
            const [idEvent, emitId] = createTestEvent<(x: number) => number>();

            // Apply identity function event to value event
            const appliedEvent = event.ap(idEvent);

            // Collect results from both events
            const original = collectValues(event);
            const applied = collectValues(appliedEvent);

            emitId((x) => x); // Identity function

            // Emit some values
            emit(1);
            emit(42);
            emit(100);

            // Identity function should not change values
            expect(applied.values).toEqual(original.values);

            // Clean up
            original.unsubscribe();
            applied.unsubscribe();
            event.cleanup();
            idEvent.cleanup();
            appliedEvent.cleanup();
        });

        // Applicative homomorphism law: pure f <*> pure x = pure (f x)
        it("should satisfy the homomorphism law", () => {
            // For events, we can test this by comparing:
            // - an event from a constant applied to another event from a constant
            // - an event created directly from the result of applying the function

            const f = (x: number) => x * 2;
            const x = 5;

            // Create pure function event and pure value event
            const [fnEvent, _] = createTestEvent(f);
            const [valueEvent, __] = createTestEvent(x);

            // Apply pure function to pure value
            const appliedEvent = valueEvent.ap(fnEvent);

            // Create event with the result directly
            const [resultEvent, ___] = createTestEvent(f(x));

            // Collect results
            const applied = collectValues(appliedEvent);
            const direct = collectValues(resultEvent);

            // Results should be the same
            expect(applied.values.length).toBeGreaterThan(0);
            expect(applied.values).toEqual(direct.values);

            // Clean up
            applied.unsubscribe();
            direct.unsubscribe();
            fnEvent.cleanup();
            valueEvent.cleanup();
            appliedEvent.cleanup();
            resultEvent.cleanup();
        });

        // Applicative composition law: pure (.) <*> u <*> v <*> w = u <*> (v <*> w)
        it("should satisfy the composition law", () => {
            // The composition law is harder to test directly with events
            // We'll test a simplified version:
            // (f <*> g <*> x) should be equivalent to (f <*> (g <*> x))

            // Create two function events and a value event
            const [fEvent, emitF] = createTestEvent<(y: number) => number>(
                (y) => y * 2
            );
            const [gEvent, emitG] = createTestEvent<(x: number) => number>(
                (x) => x + 5
            );
            const [xEvent, emitX] = createTestEvent(3);

            // Create a composed function: f . g
            const compose =
                (f: (y: number) => number) =>
                (g: (x: number) => number) =>
                (x: number) =>
                    f(g(x));

            // First approach: (compose <*> f <*> g <*> x)
            const [composeEvent, _] = createTestEvent(compose);
            const step1 = fEvent.ap(composeEvent); // compose <*> f
            const step2 = gEvent.ap(step1); // (compose <*> f) <*> g
            const result1 = xEvent.ap(step2); // (compose <*> f <*> g) <*> x

            // Second approach: (f <*> (g <*> x))
            const applied = xEvent.ap(gEvent); // g <*> x
            const result2 = applied.ap(fEvent); // f <*> (g <*> x)

            // Collect results
            const results1 = collectValues(result1);
            const results2 = collectValues(result2);

            // Emit values to trigger the evaluations
            emitG((x) => x + 10); // g = (x => x + 10)
            emitF((y) => y * 3); // f = (y => y * 3)

            // Results should match
            // For input x=3, g(x)=13, f(g(x))=39
            expect(results1.values[-1]).toEqual(results2.values[-1]);

            // Clean up
            results1.unsubscribe();
            results2.unsubscribe();
            fEvent.cleanup();
            gEvent.cleanup();
            xEvent.cleanup();
            result1.cleanup();
            result2.cleanup();
            composeEvent.cleanup();
            applied.cleanup();
        });

        it("should handle timing of event occurrences correctly", () => {
            // Create events
            const [valueEvent, emitValue] = createTestEvent(5);
            const [fnEvent, emitFn] = createTestEvent<(x: number) => number>(
                (x) => x
            );

            // Apply function event to value event
            const appliedEvent = valueEvent.ap(fnEvent);

            // Collect results
            const results = collectValues(appliedEvent);

            // Test scenario with multiple changes in sequence
            emitFn((x) => x * 2); // No output yet since we're using initial value (5)
            expect(results.values).toEqual([5, 10]); // Initial value transformation: 5 * 2 = 10

            emitValue(7); // Should emit: 7 * 2 = 14
            expect(results.values).toEqual([5, 10, 14]);

            emitFn((x) => x + 3); // Should emit: 7 + 3 = 10
            expect(results.values).toEqual([5, 10, 14, 10]);

            emitValue(1); // Should emit: 1 + 3 = 4
            expect(results.values).toEqual([5, 10, 14, 10, 4]);

            // Clean up
            results.unsubscribe();
            valueEvent.cleanup();
            fnEvent.cleanup();
            appliedEvent.cleanup();
        });

        it("should handle complex function types", () => {
            // Create an event with object values
            const [objEvent, emitObj] = createTestEvent({
                count: 0,
                name: "default",
            });

            // Create an event with functions that transform objects
            const [fnEvent, emitFn] = createTestEvent<
                (o: { count: number; name: string }) => {
                    count: number;
                    name: string;
                }
            >((o) => o);

            // Apply function event to object event
            const appliedEvent = objEvent.ap(fnEvent);

            // Collect results
            const results = collectValues(appliedEvent);

            // Emit various transformations
            emitFn((o) => ({ ...o, count: o.count + 1 }));
            emitObj({ count: 5, name: "test" });
            emitFn((o) => ({ ...o, name: o.name.toUpperCase() }));

            expect(results.values).toEqual([
                {
                    count: 0,
                    name: "default",
                },
                { count: 1, name: "default" },
                { count: 6, name: "test" },
                { count: 5, name: "TEST" },
            ]);

            // Clean up
            results.unsubscribe();
            objEvent.cleanup();
            fnEvent.cleanup();
            appliedEvent.cleanup();
        });

        it("should handle error cases gracefully", () => {
            const errorSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            // Create events
            const [valueEvent, emitValue] = createTestEvent(5);
            const [fnEvent, emitFn] = createTestEvent<(x: number) => number>(
                (x) => x
            );

            // Apply function event to value event
            const appliedEvent = valueEvent.ap(fnEvent);

            // Collect results
            const results = collectValues(appliedEvent);

            // Emit a function that throws
            emitFn((x) => {
                throw new Error("Test error");
            });

            // Should have logged the error but not crashed
            expect(errorSpy).toHaveBeenCalled();
            expect(errorSpy.mock.calls[0][0]).toContain(
                "Error applying function in ap"
            );

            // Should still be able to process subsequent events
            emitFn((x) => x * 3);
            emitValue(4);

            expect(results.values).toEqual([5, 15, 12]);

            // Clean up
            results.unsubscribe();
            valueEvent.cleanup();
            fnEvent.cleanup();
            appliedEvent.cleanup();
            errorSpy.mockRestore();
        });
    });
    */

    /*
    describe("chain method (Monad)", () => {
        // Monad left identity law: return a >>= f ≡ f a
        it("should satisfy the left identity law", () => {
            // Create a function that returns an event
            const f = (x: number) => {
                const [event, _] = createTestEvent(x * 2);
                return event;
            };

            // Value to test with
            const a = 5;

            // Create an event with just the value (equivalent to return/pure)
            const [returnA, _] = createTestEvent(a);

            // Apply the chain operation to the "return" event: return a >>= f
            const chainResult = returnA.chain(f);

            // Directly apply the function: f a
            const directResult = f(a);

            // Collect results from both paths
            const chainValues = collectValues(chainResult);
            const directValues = collectValues(directResult);

            // Initial values should be emitted and be equal
            expect(chainValues.values.length).toBeGreaterThan(0);
            expect(chainValues.values).toEqual(directValues.values);

            // Clean up
            chainValues.unsubscribe();
            directValues.unsubscribe();
            chainResult.cleanup();
            directResult.cleanup();
        });

        // Monad right identity law: m >>= return ≡ m
        it("should satisfy the right identity law", () => {
            // Create an event to test with
            const [event, emit] = createTestEvent(0);

            // Define the "return" function
            const returnFn = (x: number) => {
                const [ev, _] = createTestEvent(x);
                return ev;
            };

            // Apply chain with "return": m >>= return
            const chainResult = event.chain(returnFn);

            // Collect results from both the original event and the chained one
            const originalValues = collectValues(event);
            const chainValues = collectValues(chainResult);

            // Emit some values
            emit(1);
            emit(42);
            emit(100);

            // The results should be the same
            expect(chainValues.values).toEqual([0].concat(originalValues.values));

            // Clean up
            originalValues.unsubscribe();
            chainValues.unsubscribe();
            event.cleanup();
            chainResult.cleanup();
        });

        // Monad associativity law: (m >>= f) >>= g ≡ m >>= (\x -> f x >>= g)
        it("should satisfy the associativity law", () => {
            // Create an event to test with
            const [event, emit] = createTestEvent(0);

            // Define two functions that return events
            const f = (x: number) => {
                const [ev, _] = createTestEvent(x + 10);
                return ev;
            };

            const g = (x: number) => {
                const [ev, _] = createTestEvent(x * 2);
                return ev;
            };

            // First approach: (m >>= f) >>= g
            const firstChain = event.chain(f);
            const firstResult = firstChain.chain(g);

            // Second approach: m >>= (\x -> f x >>= g)
            const composedFG = (x: number) => f(x).chain(g);
            const secondResult = event.chain(composedFG);

            // Collect results from both approaches
            const firstValues = collectValues(firstResult);
            const secondValues = collectValues(secondResult);

            // Emit some values
            emit(1); // First: (1+10)*2 = 22, Second: (1+10)*2 = 22
            emit(5); // First: (5+10)*2 = 30, Second: (5+10)*2 = 30

            // Results should be the same
            expect(firstValues.values).toEqual(secondValues.values);

            // Clean up
            firstValues.unsubscribe();
            secondValues.unsubscribe();
            event.cleanup();
            firstChain.cleanup();
            firstResult.cleanup();
            secondResult.cleanup();
        });

        it("should correctly chain events together", { timeout: 5000 }, async () => {
            // Create initial event
            const [baseEvent, emitBase] = createTestEvent<number>();

            // Function that returns an event based on the input
            const createDerivedEvent = (x: number) => {
                const [derived, emitDerived] = createTestEvent();

                // Emit a new value after a short delay to test dynamic behavior
                setTimeout(() => {
                    emitDerived(x * 20);
                }, 10);

                return derived;
            };

            // Chain the base event with the function
            const chainedEvent = baseEvent.chain(createDerivedEvent);

            // Collect results
            const results = collectValues(chainedEvent);

            // Emit values
            emitBase(2); // Should create event with initial value 20

            // Wait for the delayed emissions
            await (new Promise<void>((resolve) => {
                setTimeout(() => {
                    emitBase(3); // Should create event with initial value 30

                    setTimeout(() => {
                        // Check all results
                        expect(results.values).toEqual([0, 20, 40, 30, 60]);

                        // Clean up
                        results.unsubscribe();
                        baseEvent.cleanup();
                        chainedEvent.cleanup();

                        console.log("Resolving")
                        resolve();
                    }, 20);
                }, 20);
            }));
        });

        it("should handle nested chaining correctly", () => {
            // Create initial event
            const [baseEvent, emitBase] = createTestEvent<number>();

            // First-level chain function
            const firstLevel = (x: number) => {
                const [ev1, emit1] = createTestEvent<number>();

                // Emit an additional value
                setTimeout(() => emit1(x * 11), 10);

                return ev1;
            };

            // Second-level chain function
            const secondLevel = (x: number) => {
                const [ev2, emit] = createTestEvent();
                emit(x + 5);
                return ev2;
            };

            // Chain the functions in sequence
            const result = baseEvent.chain(firstLevel).chain(secondLevel);

            // Collect results
            const values = collectValues(result);

            // Emit a value
            emitBase(2); // Should result in (2*10)+5 = 25

            // Wait for all the async emissions
            return new Promise<void>((resolve) => {
                setTimeout(() => {
                    // Should now include (2*11)+5 = 27
                    expect(values.values).toEqual([15, 25, 27]);

                    // Emit another value
                    emitBase(3); // Should result in (3*10)+5 = 35

                    setTimeout(() => {
                        // Should now include (3*11)+5 = 38
                        expect(values.values).toEqual([15, 25, 27, 35, 38]);

                        // Clean up
                        values.unsubscribe();
                        baseEvent.cleanup();
                        result.cleanup();

                        resolve();
                    }, 20);
                }, 20);
            });
        });

        it("should clean up inner subscriptions when outer event changes", () => {
            // Create events
            const [baseEvent, emitBase] = createTestEvent(0);

            // Create a mock for cleanup tracking
            const cleanupSpy = vi.fn();

            // Create a function that returns an event with trackable cleanup
            const createTrackableEvent = (x: number) => {
                const [event, _] = createTestEvent(x * 10);

                // Replace the cleanup method with our spy
                const originalCleanup = event.cleanup;
                (event as any).cleanup = () => {
                    cleanupSpy(x);
                    originalCleanup.call(event);
                };

                return event;
            };

            // Chain the base event
            const chained = baseEvent.chain(createTrackableEvent);

            // Subscribe to force evaluation
            const unsub = chained.subscribe(() => {});

            // Emit several values
            emitBase(1);
            emitBase(2);
            emitBase(3);

            // Each new emission should have cleaned up the previous inner event
            expect(cleanupSpy).toHaveBeenCalledTimes(3);
            expect(cleanupSpy).toHaveBeenCalledWith(0);
            expect(cleanupSpy).toHaveBeenCalledWith(1);
            expect(cleanupSpy).toHaveBeenCalledWith(2);

            // Clean up
            unsub();
            baseEvent.cleanup();
            chained.cleanup();

            // Should clean up the final inner event too
            expect(cleanupSpy).toHaveBeenCalledWith(3);
            expect(cleanupSpy).toHaveBeenCalledTimes(4);
        });

        it("should handle errors in the chain function gracefully", () => {
            // Spy on console.error
            const errorSpy = vi
                .spyOn(console, "error")
                .mockImplementation(() => {});

            // Create events
            const [baseEvent, emitBase] = createTestEvent(0);

            // Define a function that will throw for certain inputs
            const problematicFn = (x: number) => {
                if (x === 2) {
                    throw new Error("Test error");
                }
                const [event, _] = createTestEvent(x * 10);
                return event;
            };

            // Chain with the problematic function
            const chained = baseEvent.chain(problematicFn);

            // Collect values
            const results = collectValues(chained);

            // Emit values, including one that will cause an error
            emitBase(1); // Should work fine: 10
            emitBase(2); // Should throw
            emitBase(3); // Should still work: 30

            // Should have logged an error
            expect(errorSpy).toHaveBeenCalled();
            expect(errorSpy.mock.calls[0][0]).toContain(
                "Error in chain function"
            );

            // Should still have processed the valid inputs
            expect(results.values).toEqual([0, 10, 30]);

            // Clean up
            results.unsubscribe();
            baseEvent.cleanup();
            chained.cleanup();
            errorSpy.mockRestore();
        });
    });
    */
});

