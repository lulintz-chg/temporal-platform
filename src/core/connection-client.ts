import { Connection } from '@temporalio/client';
import { loadClientConnectConfig } from '@temporalio/envconfig';

export type ClientConnectionResult = { connection: Connection; namespace: string };

// Namespace comes from the same envconfig source as the connection (TEMPORAL_NAMESPACE,
// or a config profile) — never hardcode 'default' at the call site, or workers/clients
// silently split across namespaces when the env points elsewhere.
export async function createTemporalClientConnection(): Promise<ClientConnectionResult> {
  const { connectionOptions, namespace } = loadClientConnectConfig();
  const connection = await Connection.connect(connectionOptions);
  return { connection, namespace: namespace ?? 'default' };
}
