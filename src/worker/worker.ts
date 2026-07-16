import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from '../activities';
import { connectionOptions, loadNamespaceConfig } from '../config/env';

async function run() {
  const config = loadNamespaceConfig();
  const connection = await NativeConnection.connect(connectionOptions(config));

  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: 'greeting-task-queue',
    workflowsPath: require.resolve('../workflows'),
    activities,
  });

  console.log(`worker started: namespace=${config.namespace} address=${config.address}`);
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
