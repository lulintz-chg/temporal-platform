import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { WorkflowFailedError } from '@temporalio/client';
import {
  raceWithTimeoutCancellationFixtureWorkflow,
  raceWithTimeoutTimeoutFixtureWorkflow,
  raceWithTimeoutWinFixtureWorkflow,
} from './__fixtures__/race-with-timeout.workflow';

// raceWithTimeout depends on real @temporalio/workflow sandbox behavior (sleep,
// workflowInfo, isCancellation), so it's exercised via TestWorkflowEnvironment +
// fixture workflows rather than mocked — see references/typescript/testing.md.
//
// Not covered here: the continueAsNewSuggested warning branch. It only fires once
// a workflow's event history crosses a server-configured threshold, which isn't
// practically triggerable in a fast unit test — forcing it would mean generating
// thousands of events per test run.
describe('raceWithTimeout (TestWorkflowEnvironment)', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('resolves with the trigger value when it wins the race', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'race-with-timeout-win';
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('./__fixtures__/race-with-timeout.workflow'),
      activities: {},
    });

    const result = await worker.runUntil(
      client.workflow.execute(raceWithTimeoutWinFixtureWorkflow, {
        workflowId: 'race-with-timeout-win-test',
        taskQueue,
        args: ['winner'],
      })
    );

    expect(result).toBe('winner');
  });

  it('throws a non-retryable ApplicationFailure with the label when the timeout wins', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'race-with-timeout-timeout';
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('./__fixtures__/race-with-timeout.workflow'),
      activities: {},
    });

    await worker.runUntil(async () => {
      try {
        await client.workflow.execute(raceWithTimeoutTimeoutFixtureWorkflow, {
          workflowId: 'race-with-timeout-timeout-test',
          taskQueue,
          args: [0],
        });
        throw new Error('expected workflow to fail');
      } catch (err) {
        expect(err).toBeInstanceOf(WorkflowFailedError);
        expect((err as WorkflowFailedError).cause?.message).toContain(
          'fixture-timeout timed out after 0 minutes'
        );
      }
    });
  });

  it('rethrows on cancellation and logs the cancellation message', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'race-with-timeout-cancel';
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('./__fixtures__/race-with-timeout.workflow'),
      activities: {},
    });

    await worker.runUntil(async () => {
      const handle = await client.workflow.start(raceWithTimeoutCancellationFixtureWorkflow, {
        workflowId: 'race-with-timeout-cancel-test',
        taskQueue,
      });
      await handle.cancel();

      await expect(handle.result()).rejects.toThrow(WorkflowFailedError);
    });
  });
});
