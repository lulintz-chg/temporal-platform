import { scheduleActivity, type ActivityOptions } from '@temporalio/workflow';
import { deepmergeCustom } from 'deepmerge-ts';
import type { Effect } from 'effect';
import type { EffectActivities } from './types';

// Arrays (e.g. retry.nonRetryableErrorTypes) replace rather than concatenate —
// a caller passing overrideOptions expects it to override the base, not merge
// into it. The default deepmerge behavior of concatenating arrays would silently
// union the two lists instead.
const deepmerge = deepmergeCustom({ mergeArrays: false });

type EffectSuccess<T> = T extends Effect.Effect<infer A, any, any> ? A : never;

function validateActivityOptions(options: ActivityOptions): void {
  if (options.scheduleToCloseTimeout === undefined && options.startToCloseTimeout === undefined) {
    throw new TypeError('Required either scheduleToCloseTimeout or startToCloseTimeout');
  }
  if (options.retry === undefined) {
    throw new TypeError(
      'retry (RetryPolicy) must be set explicitly — omitting it silently falls back to ' +
        'the server-defined default retry policy (effectively unbounded retries up to ' +
        'scheduleToCloseTimeout). Pass {} to accept the default explicitly, or set ' +
        'maximumAttempts/other fields to bound retries.'
    );
  }
}

// `A` is the Effect-activities module (`typeof activities`); the proxy returns
// Promise-returning stubs whose resolved type is each Effect's success value,
// matching what makeActivities registers on the worker.
export function proxyActivitiesEffect<A extends EffectActivities<unknown>>(
  options: ActivityOptions
): {
  [K in keyof A]: ((...args: Parameters<A[K]>) => Promise<EffectSuccess<ReturnType<A[K]>>>) & {
    executeWithOptions: (
      overrideOptions: ActivityOptions,
      args: Parameters<A[K]>
    ) => Promise<EffectSuccess<ReturnType<A[K]>>>;
  };
} {
  if (options === undefined) {
    throw new TypeError('options must be defined');
  }
  validateActivityOptions(options);

  return new Proxy(
    {},
    {
      get(_, activityType) {
        if (typeof activityType !== 'string') {
          throw new TypeError(
            `Only strings are supported for Activity types, got: ${String(activityType)}`
          );
        }

        function activityProxyFunction(...args: unknown[]): Promise<unknown> {
          return scheduleActivity(activityType as string, args, options);
        }

        activityProxyFunction.executeWithOptions = (
          overrideOptions: ActivityOptions,
          args: unknown[]
        ): Promise<unknown> =>
          scheduleActivity(
            activityType as string,
            args,
            deepmerge(options, overrideOptions) as ActivityOptions
          );

        return activityProxyFunction;
      },
    }
  ) as never;
}
