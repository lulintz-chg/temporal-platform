import { readFile } from 'fs/promises';
import path from 'path';
import { Worker } from '@temporalio/worker';
import proto from '@temporalio/proto';

/**
 * Replays a recorded workflow execution history against the given workflow code and
 * asserts no non-determinism error occurs. Protects against accidentally breaking
 * in-flight workflows when changing workflow code — see references/core/versioning.md.
 *
 * Fixtures are serialized `History` protos, one per file, named `<name>.bin` under
 * `fixturesDir`. Generate one from a real execution:
 *
 *   const history = await client.workflow.getHandle(workflowId).fetchHistory();
 *   const bytes = proto.temporal.api.history.v1.History.encode(history).finish();
 *   await writeFile(`__fixtures__/${name}.bin`, bytes);
 *
 * Usage:
 *   await runReplayFixture(require.resolve('./domains/acme/workflow'), __dirname + '/__fixtures__', 'happy-path');
 */
export async function runReplayFixture(
  workflowsPath: string,
  fixturesDir: string,
  name: string
): Promise<void> {
  const bytes = await readFile(path.join(fixturesDir, `${name}.bin`));
  const history = proto.temporal.api.history.v1.History.decode(bytes);

  await Worker.runReplayHistory({ workflowsPath }, history);
}
