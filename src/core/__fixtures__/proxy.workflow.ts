import type { ActivityOptions } from '@temporalio/workflow';
import type { Effect } from 'effect';
import { proxyActivitiesEffect } from '../proxy';

type FixtureActivities = {
  doWork: (input: string) => Effect.Effect<string, never, never>;
};

export async function proxyFixtureWorkflow(
  options: ActivityOptions,
  input: string
): Promise<string> {
  const acts = proxyActivitiesEffect<FixtureActivities>(options);
  return acts.doWork(input);
}

export async function proxyExecuteWithOptionsFixtureWorkflow(
  options: ActivityOptions,
  overrideOptions: ActivityOptions,
  input: string
): Promise<string> {
  const acts = proxyActivitiesEffect<FixtureActivities>(options);
  return acts.doWork.executeWithOptions(overrideOptions, [input]);
}
