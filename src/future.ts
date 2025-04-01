import { Event } from "./event";

export class Future<A> {
    private value: A | null = null;
    private time: number | null = null;
    private status: "PENDING" | "RESOLVED" = "PENDING";

    constructor(
        private readonly resolver: () => {
            value: A;
            time: number;
        } | null = () => null,
    ) {}

    // Create a resolved future with a value
    static of<A>(value: A): Future<A> {
        const future = new Future<A>();
        future.value = value;
        future.time = Date.now();
        future.status = "RESOLVED";
        return future;
    }

    // Create a never-arriving future
    static never<A>(): Future<A> {
        return new Future<A>();
    }

    // Force the future to get its value (or throw if pending)
    force(): { value: A; time: number } {
        if (this.status === "RESOLVED") {
            return { value: this.value!, time: this.time! };
        }

        // Try to resolve now
        const result = this.resolver();
        if (result) {
            this.value = result.value;
            this.time = result.time;
            this.status = "RESOLVED";
            return result;
        }

        throw new Error("Cannot force a pending future");
    }

    // Try to get the value without throwing
    tryForce(): { value: A; time: number } | null {
        try {
            return this.force();
        } catch (error) {
            return null;
        }
    }

    // Get the time (Infinity if pending)
    getTime(): number {
        if (this.status === "RESOLVED") {
            return this.time!;
        }

        // Try to resolve now
        const result = this.tryForce();
        if (result) {
            return result.time;
        }

        return Infinity;
    }

    // Check if this is a never future
    isNever(): boolean {
        return this.getTime() === Infinity;
    }

    // Functor instance
    map<B>(f: (a: A) => B): Future<B> {
        if (this.isNever()) {
            return Future.never<B>();
        }

        return new Future<B>(() => {
            const result = this.tryForce();
            if (result) {
                try {
                    return {
                        value: f(result.value),
                        time: result.time,
                    };
                } catch (error) {
                    console.error("Error in map function:", error);
                }
            }
            return null;
        });
    }

    // Applicative instance
    static pure<A>(a: A): Future<A> {
        return Future.of(a);
    }

    ap<B>(ff: Future<(a: A) => B>): Future<B> {
        if (this.isNever() || ff.isNever()) {
            return Future.never<B>();
        }

        return new Future<B>(() => {
            const thisResult = this.tryForce();
            const ffResult = ff.tryForce();

            if (thisResult && ffResult) {
                try {
                    return {
                        value: ffResult.value(thisResult.value),
                        time: Math.max(thisResult.time, ffResult.time),
                    };
                } catch (error) {
                    console.error("Error in ap function:", error);
                }
            }
            return null;
        });
    }

    // Monad instance
    flatMap<B>(f: (a: A) => Future<B>): Future<B> {
        if (this.isNever()) {
            return Future.never<B>();
        }

        return new Future<B>(() => {
            const result = this.tryForce();
            if (result) {
                try {
                    const nextFuture = f(result.value);
                    const nextResult = nextFuture.tryForce();

                    if (nextResult) {
                        return {
                            value: nextResult.value,
                            time: Math.max(result.time, nextResult.time),
                        };
                    }
                } catch (error) {
                    console.error("Error in flatMap function:", error);
                }
            }
            return null;
        });
    }

    // Get the earlier of two futures
    static min<A>(a: Future<A>, b: Future<A>): Future<A> {
        if (a.isNever()) return b;
        if (b.isNever()) return a;

        return new Future<A>(() => {
            const resultA = a.tryForce();
            const resultB = b.tryForce();

            if (resultA && resultB) {
                return resultA.time <= resultB.time ? resultA : resultB;
            }

            return resultA || resultB;
        });
    }

    toEvent(): Event<A> {
        const [event, emit] = Event.create<A>();

        return event;
    }
}
