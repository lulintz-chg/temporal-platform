// sync: provider answered immediately (e.g. cached hit); skip waiting for a callback signal
// async: provider kicked off an external job; workflow must wait for a webhook signal
export type InitiateResult<TResult = unknown> =
  { mode: 'sync'; result: TResult } | { mode: 'async' };
