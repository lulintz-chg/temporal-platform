import { Connection, Client } from '@temporalio/client';
import { greetingWorkflow } from '../workflows';
import { connectionOptions, loadNamespaceConfig } from '../config/env';

async function run() {
  const config = loadNamespaceConfig();
  const connection = await Connection.connect(connectionOptions(config));
  const client = new Client({ connection, namespace: config.namespace });

  const result = await client.workflow.execute(greetingWorkflow, {
    taskQueue: 'greeting-task-queue',
    workflowId: `greeting-${Date.now()}`,
    args: ['World'],
  });

  console.log(result);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
