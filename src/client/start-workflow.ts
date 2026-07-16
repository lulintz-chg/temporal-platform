import { randomUUID } from 'crypto';
import { Connection, Client } from '@temporalio/client';
import { connectionOptions, loadNamespaceConfig } from '../config/env';

// Generic CLI to start any workflow by type name — this platform repo doesn't
// know about specific workflows, so it can't import a typed workflow function.
// Usage: ts-node src/client/start-workflow.ts <workflowType> [argsAsJsonArray]
async function run() {
  const [workflowType, argsJson] = process.argv.slice(2);
  if (!workflowType) {
    throw new Error('usage: start-workflow <workflowType> [argsAsJsonArray]');
  }
  const args = argsJson ? JSON.parse(argsJson) : [];

  const taskQueue = process.env.TEMPORAL_TASK_QUEUE;
  if (!taskQueue) {
    throw new Error('missing required env var TEMPORAL_TASK_QUEUE');
  }

  const config = loadNamespaceConfig();
  const connection = await Connection.connect(connectionOptions(config));
  const client = new Client({ connection, namespace: config.namespace });

  const result = await client.workflow.execute(workflowType, {
    taskQueue,
    workflowId: `${workflowType}-${randomUUID()}`,
    args,
  });

  console.log(JSON.stringify(result));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
