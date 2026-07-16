import path from 'path';
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from '../activities';
import { connectionOptions, loadNamespaceConfig } from '../config/env';

const isProduction = process.env.TEMPORAL_WORKER_MODE === 'production';

async function run() {
  const config = loadNamespaceConfig();
  const connection = await NativeConnection.connect(connectionOptions(config));

  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue: 'greeting-task-queue',
    activities,
    // `workflowBundle` (pre-bundled via `npm run build:workflow-bundle`) avoids
    // bundling at startup and is required for production; `workflowsPath`
    // bundles on the fly and is only suitable for local development.
    ...(isProduction
      ? { workflowBundle: { codePath: path.join(__dirname, '..', '..', 'dist', 'workflow-bundle.js') } }
      : { workflowsPath: require.resolve('../workflows') }),
    shutdownGraceTime: '30 seconds',
  });

  console.log(`worker started: namespace=${config.namespace} address=${config.address} mode=${isProduction ? 'production' : 'development'}`);

  process.once('SIGINT', () => worker.shutdown());
  process.once('SIGTERM', () => worker.shutdown());

  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
