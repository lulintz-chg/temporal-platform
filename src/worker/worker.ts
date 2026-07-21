import path from 'path';
import 'dotenv/config';
import { startWorker } from '../core/connection-worker';

const isProduction = process.env.TEMPORAL_WORKER_MODE === 'production';

// This platform repo hosts no workflow/activity code itself — TEMPORAL_APP_ENTRY
// points at the app package (or, for local fixtures, a directory) that exports
// `<entry>/workflows` and `<entry>/activities` subpaths.
function requireAppEntry(): string {
  const entry = process.env.TEMPORAL_APP_ENTRY;
  if (!entry) {
    throw new Error(
      'missing required env var TEMPORAL_APP_ENTRY (module or path exporting workflows/ and activities/)'
    );
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

// require() of the activities module includes non-function exports (__esModule,
// default, re-exported types). Register only the function exports so a stray
// export can't become a bogus activity registration.
function onlyFunctions(
  mod: Record<string, unknown>
): Record<string, (...args: unknown[]) => unknown> {
  return Object.fromEntries(
    Object.entries(mod).filter(([, value]) => typeof value === 'function')
  ) as Record<string, (...args: unknown[]) => unknown>;
}

async function run() {
  const appEntry = requireAppEntry();
  const taskQueue = requireTaskQueue();

  await startWorker({
    taskQueue,
    // eslint-disable-next-line @typescript-eslint/no-var-requires -- dynamic app entry
    activities: onlyFunctions(require(`${appEntry}/activities`)),
    // `workflowBundle` (pre-bundled via `npm run build:workflow-bundle`) avoids
    // bundling at startup and is required for production; `workflowsPath`
    // bundles on the fly and is only suitable for local development.
    ...(isProduction
      ? {
          workflowBundle: {
            codePath:
              process.env.TEMPORAL_WORKFLOW_BUNDLE_PATH ??
              path.join(__dirname, '..', '..', 'dist', 'workflow-bundle.js'),
          },
        }
      : { workflowsPath: require.resolve(`${appEntry}/workflows`) }),
    shutdownGraceTime: '30 seconds',
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
