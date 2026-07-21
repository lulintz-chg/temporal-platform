// Workflow-bundle-safe entry point — only imports from @temporalio/workflow.
// Import from '@chg/workflow-orchestration-core/workflow' in your workflow files.
// Never import the main package index from workflow code — it pulls in
// @temporalio/client and @temporalio/worker which are banned in workflow context.
export { callbackSignal } from './signals';
export { waitForCallback } from './utils';
export { proxyActivitiesEffect } from './proxy';
export { defineUpdate, waitForUpdate } from './updates';
