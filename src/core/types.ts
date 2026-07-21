import type { Effect } from 'effect';

// Activities authored as Effect-returning functions. `R` is the activity environment
// satisfied by the worker's ManagedRuntime; the error channel is intentionally
// unconstrained — runPromise rejects on failure and Temporal turns the rejection
// into an activity-task failure.
// `never[]` params accept any activity signature under strictFunctionTypes
// (params are contravariant); Parameters<A[K]> still recovers the real args.
export type EffectActivities<R> = Record<
  string,
  (...args: never[]) => Effect.Effect<unknown, unknown, R>
>;
