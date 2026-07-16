import path from 'path';
import { NativeConnection, Worker } from '@temporalio/worker';
import { connectionOptions, loadNamespaceConfig } from '../config/env';

const isProduction = process.env.TEMPORAL_WORKER_MODE === 'production';

// This platform repo hosts no workflow/activity code itself — TEMPORAL_APP_ENTRY
// points at the app package (or, for local fixtures, a directory) that exports
// `<entry>/workflows` and `<entry>/activities` subpaths.
function requireAppEntry(): string {
  const entry = process.env.TEMPORAL_APP_ENTRY;
  if (!entry) {
    throw new Error('missing required env var TEMPORAL_APP_ENTRY (module or path exporting workflows/ and activities/)');
  }
  return entry;
}

function requireTaskQueue(): string {
  const taskQueue = process.env.TEMPORAL_TASK_QUEUE;
  if (!taskQueue) {
    throw new Error('missing required env var TEMPORAL_TASK_QUEUE');
  }
  return taskQueue;
}

async function run() {
  const config = loadNamespaceConfig();
  const connection = await NativeConnection.connect(connectionOptions(config));
  const appEntry = requireAppEntry();
  const taskQueue = requireTaskQueue();

  const worker = await Worker.create({
    connection,
    namespace: config.namespace,
    taskQueue,
    activities: require(`${appEntry}/activities`),
    // `workflowBundle` (pre-bundled via `npm run build:workflow-bundle`) avoids
    // bundling at startup and is required for production; `workflowsPath`
    // bundles on the fly and is only suitable for local development.
    ...(isProduction
      ? { workflowBundle: { codePath: process.env.TEMPORAL_WORKFLOW_BUNDLE_PATH ?? path.join(__dirname, '..', '..', 'dist', 'workflow-bundle.js') } }
      : { workflowsPath: require.resolve(`${appEntry}/workflows`) }),
    shutdownGraceTime: '30 seconds',
  });

  console.log(
    `worker started: namespace=${config.namespace} address=${config.address} taskQueue=${taskQueue} mode=${isProduction ? 'production' : 'development'}`
  );

  process.once('SIGINT', () => worker.shutdown());
  process.once('SIGTERM', () => worker.shutdown());

  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
