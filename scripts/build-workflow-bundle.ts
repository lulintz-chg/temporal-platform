import { bundleWorkflowCode } from '@temporalio/worker';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

async function main() {
  const appEntry = process.env.TEMPORAL_APP_ENTRY;
  if (!appEntry) {
    throw new Error(
      'missing required env var TEMPORAL_APP_ENTRY (module or path exporting a workflows/ subpath)'
    );
  }

  const { code } = await bundleWorkflowCode({
    workflowsPath: require.resolve(`${appEntry}/workflows`),
  });

  const outPath =
    process.env.TEMPORAL_WORKFLOW_BUNDLE_PATH ??
    path.join(__dirname, '..', 'dist', 'workflow-bundle.js');
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, code);
  console.log(`workflow bundle written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
