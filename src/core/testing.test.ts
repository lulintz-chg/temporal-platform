import { writeFile, mkdtemp, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker } from '@temporalio/worker';
import proto from '@temporalio/proto';
import { runReplayFixture } from './testing';
import { waitForCallbackFixtureWorkflow } from './__fixtures__/wait-for-callback.workflow';
import { callbackSignal } from './signals';

describe('runReplayFixture', () => {
  let testEnv: TestWorkflowEnvironment;
  let fixturesDir: string;

  beforeAll(async () => {
    testEnv = await TestWorkflowEnvironment.createLocal();
    fixturesDir = await mkdtemp(path.join(os.tmpdir(), 'replay-fixtures-'));
  });

  afterAll(async () => {
    await testEnv?.teardown();
    await rm(fixturesDir, { recursive: true, force: true });
  });

  it('replays a recorded history without throwing a non-determinism error', async () => {
    const { client, nativeConnection } = testEnv;
    const taskQueue = 'replay-fixture-basic';

    const worker = await Worker.create({
      connection: nativeConnection,
      taskQueue,
      workflowsPath: require.resolve('./__fixtures__/wait-for-callback.workflow'),
      activities: {},
    });

    await worker.runUntil(async () => {
      const handle = await client.workflow.start(waitForCallbackFixtureWorkflow, {
        workflowId: 'replay-fixture-basic-test',
        taskQueue,
        args: [5],
      });
      await handle.signal(callbackSignal, { hello: 'world' });
      await handle.result();

      const history = await handle.fetchHistory();
      const bytes = proto.temporal.api.history.v1.History.encode(history).finish();
      await writeFile(path.join(fixturesDir, 'happy-path.bin'), bytes);
    });

    await runReplayFixture(
      require.resolve('./__fixtures__/wait-for-callback.workflow'),
      fixturesDir,
      'happy-path'
    );
  });
});
