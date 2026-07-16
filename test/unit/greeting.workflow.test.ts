import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { greetingWorkflow } from '../../src/workflows';

describe('greetingWorkflow', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createTimeSkipping();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('returns a greeting built from the activity result', async () => {
    const { client, nativeConnection } = testEnv;

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue: 'test-greeting-task-queue',
      workflowsPath: require.resolve('../../src/workflows'),
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
