import { NativeConnection, Worker, bundleWorkflowCode } from '@temporalio/worker';
import { loadClientConnectConfig } from '@temporalio/envconfig';
import type { Effect } from 'effect';
import type { ManagedRuntime } from 'effect/ManagedRuntime';
import type { EffectActivities } from './types';

export { Worker };

type WorkflowBundleOption = NonNullable<Parameters<typeof Worker.create>[0]['workflowBundle']>;

type WorkflowSource =
  | { workflowsPath: string; workflowBundle?: never }
  | { workflowBundle: WorkflowBundleOption; workflowsPath?: never };

export type WorkerOptions = {
  taskQueue: string;
  activities: Record<string, (...args: unknown[]) => unknown>;
  namespace?: string;
  shutdownGraceTime?: Parameters<typeof Worker.create>[0]['shutdownGraceTime'];
} & WorkflowSource;

export type NativeConnectionResult = { connection: NativeConnection; namespace: string };

// Uses the same envconfig source as createTemporalClientConnection so TLS,
// mTLS certs, Temporal Cloud addresses, and namespace are picked up consistently.
// Namespace comes back alongside the connection — never hardcode 'default' at the
// call site, or workers silently split across namespaces when the env points elsewhere.
export async function createTemporalNativeConnection(): Promise<NativeConnectionResult> {
  const { connectionOptions, namespace } = loadClientConnectConfig();
  const connection = await NativeConnection.connect(connectionOptions);
  return { connection, namespace: namespace ?? 'default' };
}

// Turns a module of Effect-returning activities into the Promise-returning shape
// Worker.create expects, running each Effect on the supplied runtime.
export function makeActivities<R, ER, A extends EffectActivities<R>>(
  runtime: ManagedRuntime<R, ER>,
  effects: A
): {
  [K in keyof A]: (...args: Parameters<A[K]>) => Promise<Effect.Effect.Success<ReturnType<A[K]>>>;
} {
  return Object.fromEntries(
    Object.entries(effects).map(([name, fn]) => [
      name,
      (...args: unknown[]) =>
        runtime.runPromise(
          (fn as (...args: unknown[]) => Effect.Effect<unknown, unknown, R>)(...args)
        ),
    ])
  ) as never;
}

export async function buildWorkflowBundle(workflowsPath: string): Promise<WorkflowBundleOption> {
  return bundleWorkflowCode({ workflowsPath });
}

// startWorker wraps connection + Worker.create + graceful shutdown in one call.
// Use it when your worker has no pre-startup work (SA registration, pool init, etc.).
// For anything more complex, use createTemporalNativeConnection + Worker.create directly
// (import Worker from this package to avoid dual-native-module issues in non-monorepo setups).
export async function startWorker({
  taskQueue,
  workflowsPath,
  activities,
  namespace,
  workflowBundle,
  shutdownGraceTime,
}: WorkerOptions): Promise<void> {
  const { connection, namespace: configuredNamespace } = await createTemporalNativeConnection();
  namespace = namespace ?? configuredNamespace;

  if (!workflowBundle) {
    console.warn('[temporal] workflowBundle not provided — bundling at startup. Dev only.');
  }

  try {
    const worker = await Worker.create({
      connection,
      namespace,
      taskQueue,
      activities,
      ...(workflowBundle ? { workflowBundle } : { workflowsPath }),
      ...(shutdownGraceTime ? { shutdownGraceTime } : {}),
    });

    console.log(
      `worker started: namespace=${namespace} taskQueue=${taskQueue} mode=${workflowBundle ? 'production' : 'development'}`
    );

    const shutdown = () => {
      worker.shutdown();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);

    try {
      await worker.run();
    } finally {
      process.off('SIGINT', shutdown);
      process.off('SIGTERM', shutdown);
    }
  } finally {
    await connection.close();
  }
}
