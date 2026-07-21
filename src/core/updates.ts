import { setHandler, Trigger, type defineUpdate } from '@temporalio/workflow';
import { raceWithTimeout } from './wait-with-timeout';

export { defineUpdate } from '@temporalio/workflow';

// Derive the update handle type from the SDK's defineUpdate return type so we
// don't depend on @temporalio/common directly.
type UpdateDef<TResult, TInput extends unknown[]> = ReturnType<
  typeof defineUpdate<TResult, TInput>
>;

/**
 * Analogous to waitForCallback but for Temporal Updates (request/reply semantics).
 * Registers the update handler synchronously before any await so a fast update
 * isn't dropped, then races against a timeout. The `reply` function computes the
 * return value sent back to the update caller — it can be async (e.g. await an
 * activity) and is invoked concurrently with the race, not blocking it.
 *
 * Usage:
 *   const updatePromise = waitForUpdate(myUpdate, 5, async (...args) => computeResult(...args));
 *   const initResult = await acts.initiate(input);   // first await is safe
 *   const updateInput = await updatePromise;          // wait for caller
 */
export async function waitForUpdate<TResult, TInput extends unknown[]>(
  update: UpdateDef<TResult, TInput>,
  timeoutMinutes: number,
  reply: (...args: TInput) => TResult | Promise<TResult>
): Promise<TInput> {
  const trigger = new Trigger<TInput>();

  setHandler(update, async (...args: TInput): Promise<TResult> => {
    trigger.resolve(args);
    return reply(...args);
  });

  return raceWithTimeout(Promise.resolve(trigger), timeoutMinutes, { label: 'waitForUpdate' });
}
