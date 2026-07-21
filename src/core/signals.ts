import { defineSignal } from '@temporalio/workflow';

// Module-level — Temporal requires signal definitions to be stable across replays.
// All domains share this signal name; each workflow instance has isolated handlers.
export const callbackSignal = defineSignal<[unknown]>('workflowCallback');
