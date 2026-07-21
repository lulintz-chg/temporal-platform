import { randomUUID } from 'crypto';
import 'dotenv/config';
import { Client } from '@temporalio/client';
import { createTemporalClientConnection } from '../core/connection-client';

// Generic CLI to start any workflow by type name — this platform repo doesn't
// know about specific workflows, so it can't import a typed workflow function.
// Usage: ts-node src/client/start-workflow.ts <workflowType> [argsAsJsonArray]
async function run() {
  const [workflowType, argsJson] = process.argv.slice(2);
  if (!workflowType) {
    throw new Error('usage: start-workflow <workflowType> [argsAsJsonArray]');
  }
  let args: unknown[] = [];
  if (argsJson) {
    const parsed = JSON.parse(argsJson);
    if (!Array.isArray(parsed)) {
      throw new Error('argsAsJsonArray must be a JSON array, e.g. \'["foo", 42]\'');
    }
    args = parsed;
  }

  const taskQueue = process.env.TEMPORAL_TASK_QUEUE;
  if (!taskQueue) {
    throw new Error('missing required env var TEMPORAL_TASK_QUEUE');
  }

  const { connection, namespace } = await createTemporalClientConnection();
  const client = new Client({ connection, namespace });

  try {
    const result = await client.workflow.execute(workflowType, {
      taskQueue,
      workflowId: `${workflowType}-${randomUUID()}`,
      args,
    });

    console.log(JSON.stringify(result));
  } finally {
    await connection.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
