import { waitForCallback } from '../utils';

export async function waitForCallbackFixtureWorkflow(timeoutMinutes: number): Promise<unknown> {
  return waitForCallback(timeoutMinutes);
}

export async function waitForCallbackTwiceFixtureWorkflow(timeoutMinutes: number): Promise<string> {
  const first = waitForCallback(timeoutMinutes);
  first.catch(() => {
    // Swallowed — the workflow ends before this settles; only the second call's
    // synchronous guard-throw matters for this fixture.
  });

  try {
    await waitForCallback(timeoutMinutes);
    return 'unexpected: no throw';
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
