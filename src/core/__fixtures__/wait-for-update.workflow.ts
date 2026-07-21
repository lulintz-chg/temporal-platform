import { defineUpdate, waitForUpdate } from '../updates';

export const testUpdate = defineUpdate<string, [{ foo: number }]>('testUpdate');

export async function waitForUpdateFixtureWorkflow(timeoutMinutes: number): Promise<unknown> {
  return waitForUpdate(testUpdate, timeoutMinutes, (input) => `replied:${JSON.stringify(input)}`);
}
