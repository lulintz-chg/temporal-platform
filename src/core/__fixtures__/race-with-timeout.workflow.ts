import { Trigger } from '@temporalio/workflow';
import { raceWithTimeout } from '../wait-with-timeout';

export async function raceWithTimeoutWinFixtureWorkflow(value: string): Promise<string> {
  const trigger = new Trigger<string>();
  trigger.resolve(value);
  return raceWithTimeout(Promise.resolve(trigger), 5, { label: 'fixture-win' });
}

export async function raceWithTimeoutTimeoutFixtureWorkflow(
  timeoutMinutes: number
): Promise<string> {
  // Never resolved — exercises the timeout branch of the race.
  const trigger = new Trigger<string>();
  return raceWithTimeout(Promise.resolve(trigger), timeoutMinutes, { label: 'fixture-timeout' });
}

export async function raceWithTimeoutCancellationFixtureWorkflow(): Promise<string> {
  const trigger = new Trigger<string>();
  return raceWithTimeout(Promise.resolve(trigger), 5, {
    label: 'fixture-cancel',
    cancellationMessage: 'custom-cancel-message',
  });
}
