import { bundleWorkflowCode } from '@temporalio/worker';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

async function main() {
  const { code } = await bundleWorkflowCode({
    workflowsPath: require.resolve('../src/workflows'),
  });

  const outDir = path.join(__dirname, '..', 'dist');
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'workflow-bundle.js'), code);
  console.log('workflow bundle written to dist/workflow-bundle.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
