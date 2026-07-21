import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { WorkflowFailedError } from '@temporalio/client';
import { waitForUpdateFixtureWorkflow, testUpdate } from './__fixtures__/wait-for-update.workflow';

describe('waitForUpdate (TestWorkflowEnvironment)', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('executeUpdate returns the reply value and the workflow resolves with the update args', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'wait-for-update-basic';
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('./__fixtures__/wait-for-update.workflow'),
      activities: {},
    });

    const { replyValue, workflowResult } = await worker.runUntil(async () => {
      const handle = await client.workflow.start(waitForUpdateFixtureWorkflow, {
        workflowId: 'wait-for-update-basic-test',
        taskQueue,
        args: [5],
      });
      const replyValue = await handle.executeUpdate(testUpdate, { args: [{ foo: 1 }] });
      const workflowResult = await handle.result();
      return { replyValue, workflowResult };
    });

    expect(replyValue).toBe('replied:{"foo":1}');
    expect(workflowResult).toEqual([{ foo: 1 }]);
  });

  it('fails with a non-retryable ApplicationFailure when no update arrives before the timeout', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'wait-for-update-timeout';
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('./__fixtures__/wait-for-update.workflow'),
      activities: {},
    });

    await worker.runUntil(async () => {
      try {
        await client.workflow.execute(waitForUpdateFixtureWorkflow, {
          workflowId: 'wait-for-update-timeout-test',
          taskQueue,
          args: [0],
        });
        throw new Error('expected workflow to fail');
      } catch (err) {
        expect(err).toBeInstanceOf(WorkflowFailedError);
        expect((err as WorkflowFailedError).cause?.message).toContain(
          'waitForUpdate timed out after 0 minutes'
        );
      }
    });
  });
});
