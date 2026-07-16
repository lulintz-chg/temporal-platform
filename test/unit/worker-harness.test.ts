import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { greetingWorkflow } from '../fixtures/greeting/workflows';

// This platform repo has no workflows/activities of its own — this test uses
// the greeting fixture only to prove the Worker/TestWorkflowEnvironment
// harness itself works end-to-end.
describe('worker harness', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    // The fixture workflow has no timers, so a full local server (no
    // time-skipping) is preferred per Temporal SDK testing guidance.
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('runs a workflow end-to-end against the test environment', async () => {
    const { client, nativeConnection } = testEnv;

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test-greeting-task-queue',
      workflowsPath: require.resolve('../fixtures/greeting/workflows'),
      activities: {
        composeGreeting: async (name: string) => `Hello, ${name}!`,
      },
    });

    const result = await worker.runUntil(
      client.workflow.execute(greetingWorkflow, {
        taskQueue: 'test-greeting-task-queue',
        workflowId: 'test-greeting-workflow',
        args: ['World'],
      })
    );

    expect(result).toBe('Hello, World!');
  });
});
