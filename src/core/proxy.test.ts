import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import { proxyActivitiesEffect } from './proxy';
import {
  proxyExecuteWithOptionsFixtureWorkflow,
  proxyFixtureWorkflow,
} from './__fixtures__/proxy.workflow';

// These branches all run before any @temporalio/workflow API is touched
// (validateActivityOptions, and the Proxy `get` trap's typeof check), so they're
// plain synchronous unit tests — no TestWorkflowEnvironment/sandbox needed.
// The scheduleActivity-calling behavior itself is covered by the
// TestWorkflowEnvironment integration test below.
describe('proxyActivitiesEffect validation', () => {
  it('throws when options is undefined', () => {
    expect(() => proxyActivitiesEffect(undefined as never)).toThrow('options must be defined');
  });

  it('throws when neither scheduleToCloseTimeout nor startToCloseTimeout is set', () => {
    expect(() => proxyActivitiesEffect({ retry: {} })).toThrow(
      'Required either scheduleToCloseTimeout or startToCloseTimeout'
    );
  });

  it('throws when retry is omitted', () => {
    expect(() => proxyActivitiesEffect({ startToCloseTimeout: '1 minute' })).toThrow(
      /retry \(RetryPolicy\) must be set explicitly/
    );
  });

  it('accepts an explicit empty retry object', () => {
    expect(() =>
      proxyActivitiesEffect({ startToCloseTimeout: '1 minute', retry: {} })
    ).not.toThrow();
  });

  it('rejects non-string activity types on property access', () => {
    const proxy = proxyActivitiesEffect({ startToCloseTimeout: '1 minute', retry: {} });
    expect(() => (proxy as unknown as Record<symbol, unknown>)[Symbol.iterator]).toThrow(
      'Only strings are supported for Activity types'
    );
  });
});

describe('proxyActivitiesEffect scheduling (TestWorkflowEnvironment)', () => {
  let testEnv: TestWorkflowEnvironment;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
  });

  afterAll(async () => {
    await testEnv?.teardown();
  });

  it('calls the registered activity with the given args and resolves with its result', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'proxy-fixture-basic';
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('./__fixtures__/proxy.workflow'),
      activities: { doWork: async (input: string) => input.toUpperCase() },
    });

    const result = await worker.runUntil(
      client.workflow.execute(proxyFixtureWorkflow, {
        workflowId: 'proxy-fixture-basic-test',
        taskQueue,
        args: [{ startToCloseTimeout: '10s', retry: { maximumAttempts: 1 } }, 'hello'],
      })
    );

    expect(result).toBe('HELLO');
  });

  it('executeWithOptions merges override options over the base options', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'proxy-fixture-execute-with-options';
    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('./__fixtures__/proxy.workflow'),
      activities: {
        // Deliberately slower than the base startToCloseTimeout so the test only
        // passes if executeWithOptions' merged (longer) timeout actually took effect.
        doWork: async (input: string) => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return input.toUpperCase();
        },
      },
    });

    const result = await worker.runUntil(
      client.workflow.execute(proxyExecuteWithOptionsFixtureWorkflow, {
        workflowId: 'proxy-fixture-execute-with-options-test',
        taskQueue,
        args: [
          { startToCloseTimeout: '1s', retry: { maximumAttempts: 1 } },
          { startToCloseTimeout: '10s' },
          'merged',
        ],
      })
    );

    expect(result).toBe('MERGED');
  });
});
