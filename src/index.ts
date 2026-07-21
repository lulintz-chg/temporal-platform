// Core domain logic for building durable, callback-driven Temporal workflows —
// non-workflow code (workers, clients, scripts) imports from here.
// Workflow-safe code must import from '@chg/temporal-platform/workflow' instead
// (see src/core/workflow-exports.ts) — this entry pulls in @temporalio/client and
// @temporalio/worker, both banned inside a workflow bundle.
export { callbackSignal } from './core/signals';
export { waitForCallback, resetCallbackHandlerForTesting } from './core/utils';
export { waitForUpdate, defineUpdate } from './core/updates';
export { runReplayFixture } from './core/testing';

// Temporal connections — explicit lifecycle helpers, envconfig-backed so the
// same env vars work against local Docker and Temporal Cloud with no code change.
export { createTemporalClientConnection } from './core/connection-client';
export type { ClientConnectionResult } from './core/connection-client';
export { createTemporalNativeConnection } from './core/connection-worker';
export type { NativeConnectionResult } from './core/connection-worker';

// Worker — import Worker from here (not @temporalio/worker directly) to avoid
// dual-native-module issues in non-monorepo setups.
// Use startWorker for simple workers with no pre-startup work.
// Use Worker.create directly when you need pre-startup steps (SA registration, etc.).
export { Worker, startWorker, buildWorkflowBundle, makeActivities } from './core/connection-worker';
export type { WorkerOptions } from './core/connection-worker';

// proxyActivitiesEffect — typed proxy for Effect-returning activity modules.
// Import from './workflow' (workflow-safe) in workflow files.
export { proxyActivitiesEffect } from './core/proxy';
export type { EffectActivities } from './core/types';

// Search attributes
export { registerSearchAttributes } from './core/search-attributes';
export type { IndexedValueTypeName, SearchAttributeMap } from './core/search-attributes';

// Types
export type { InitiateResult } from './core/interfaces';
