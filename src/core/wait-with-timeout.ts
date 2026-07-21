import { ApplicationFailure, isCancellation, log, sleep, workflowInfo } from '@temporalio/workflow';

interface RaceWithTimeoutOptions {
  /** Used in the continueAsNew warning and the default timeout/cancellation messages. */
  label: string;
  /** Overrides the default log message logged when the workflow is cancelled mid-wait. */
  cancellationMessage?: string;
}

/**
 * Shared by waitForCallback and waitForUpdate: races an already-registered handler's
 * trigger against a timeout, throwing a non-retryable ApplicationFailure on timeout and
 * warning (via workflowInfo().continueAsNewSuggested) when the caller should be looping
 * with continueAsNew instead of accumulating history indefinitely.
 */
export async function raceWithTimeout<T>(
  trigger: Promise<T>,
  timeoutMinutes: number,
  options: RaceWithTimeoutOptions
): Promise<T> {
  if (workflowInfo().continueAsNewSuggested) {
    log.warn(
      `${options.label}: continueAsNewSuggested is true — if this workflow loops on ` +
        `${options.label}, call continueAsNew to cap history growth`
    );
  }

  try {
    const outcome = await Promise.race([
      trigger.then((value) => ({ ok: true as const, value })),
      sleep(`${timeoutMinutes} minutes`).then(() => ({ ok: false as const })),
    ]);

    if (!outcome.ok) {
      throw ApplicationFailure.nonRetryable(
        `${options.label} timed out after ${timeoutMinutes} minutes`
      );
    }
    return outcome.value;
  } catch (err) {
    if (isCancellation(err)) {
      log.warn(options.cancellationMessage ?? `${options.label}: workflow cancelled while waiting`);
    }
    throw err;
  }
}
