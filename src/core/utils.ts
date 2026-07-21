import { setHandler, Trigger, workflowInfo } from '@temporalio/workflow';
import { callbackSignal } from './signals';
import { raceWithTimeout } from './wait-with-timeout';

// Keyed by runId rather than a bare module-level boolean so the guard stays correct
// even if a future worker/bundling change causes module state to be shared across
// executions (Temporal's documented per-execution V8 isolate should already prevent
// this, but the runId key removes the reliance on that assumption holding forever).
// Bounded (not just an ever-growing Set) since a long-lived worker processes an
// unbounded number of distinct executions over its lifetime — insertion order is
// preserved by Set, so evicting the oldest entry is an O(1) FIFO trim.
const MAX_TRACKED_RUN_IDS = 10_000;
const registeredRunIds = new Set<string>();

function trackRunId(runId: string): void {
  registeredRunIds.add(runId);
  if (registeredRunIds.size > MAX_TRACKED_RUN_IDS) {
    const oldest = registeredRunIds.values().next().value;
    if (oldest !== undefined) registeredRunIds.delete(oldest);
  }
}

/** Only for use in tests that call waitForCallback outside a Temporal test environment. */
export function resetCallbackHandlerForTesting(): void {
  registeredRunIds.clear();
}

/**
 * Call this BEFORE any await in your workflow function. Registers the callback signal
 * handler synchronously so a fast callback arriving before the race isn't dropped,
 * then returns a Promise that resolves with the raw callback body or throws on timeout.
 *
 * Signal source: the webhook server (webhook-server.ts) receives a POST from the external
 * provider and calls client.workflow.signal(callbackSignal, body). Temporal delivers that
 * signal here, resolving the Trigger. The worker then picks up the resumed workflow task
 * and continues execution (typically calling parseResult() next).
 *
 * Can only be called ONCE per workflow execution — callbackSignal is a single shared
 * signal. For multi-step callbacks, define your own signals alongside this one.
 *
 * IMPORTANT: Set scheduleToCloseTimeout on your proxyActivities to cap queue time
 * when a worker is down — without it, activities queue indefinitely.
 *
 * Usage:
 *   const callbackPromise = waitForCallback(input.timeoutMinutes ?? 5); // registers handler — no await yet
 *   const initResult = await acts.myInitiate(input, id);                 // first await is safe
 *   const rawBody = await callbackPromise;                               // wait for signal
 */
export async function waitForCallback(timeoutMinutes: number): Promise<unknown> {
  const runId = workflowInfo().runId;
  if (registeredRunIds.has(runId)) {
    throw new Error(
      'waitForCallback called more than once in this workflow execution. ' +
        'callbackSignal is single-use per workflow. Define a custom signal for multi-step callbacks.'
    );
  }
  trackRunId(runId);

  const trigger = new Trigger<unknown>();
  setHandler(callbackSignal, (body) => trigger.resolve(body));

  return raceWithTimeout(Promise.resolve(trigger), timeoutMinutes, {
    label: 'waitForCallback',
    // External job was already initiated — provider-side work may still be running.
    cancellationMessage:
      'waitForCallback: workflow cancelled while waiting for callback — if an external job was initiated, manual cleanup may be required',
  });
}
