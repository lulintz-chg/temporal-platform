import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { callbackSignal } from './signals';
import { resetCallbackHandlerForTesting } from './utils';
import {
  waitForCallbackFixtureWorkflow,
  waitForCallbackTwiceFixtureWorkflow,
} from './__fixtures__/wait-for-callback.workflow';

describe('resetCallbackHandlerForTesting', () => {
  it('clears the guard without throwing', () => {
    expect(() => resetCallbackHandlerForTesting()).not.toThrow();
  });
});

describe('waitForCallback (TestWorkflowEnvironment)', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('resolves with the signaled body', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'wait-for-callback-signal';
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('./__fixtures__/wait-for-callback.workflow'),
      activities: {},
    });

    const result = await worker.runUntil(async () => {
      const handle = await client.workflow.start(waitForCallbackFixtureWorkflow, {
        workflowId: 'wait-for-callback-signal-test',
        taskQueue,
        args: [5],
      });
      await handle.signal(callbackSignal, { hello: 'world' });
      return handle.result();
    });

    expect(result).toEqual({ hello: 'world' });
  });

  it('throws when called twice in the same workflow execution', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'wait-for-callback-twice';
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('./__fixtures__/wait-for-callback.workflow'),
      activities: {},
    });

    const result = await worker.runUntil(
      client.workflow.execute(waitForCallbackTwiceFixtureWorkflow, {
        workflowId: 'wait-for-callback-twice-test',
        taskQueue,
        args: [5],
      })
    );

    expect(result).toContain('waitForCallback called more than once');
  });
});
