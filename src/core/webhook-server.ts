import 'dotenv/config';
import { timingSafeEqual } from 'crypto';
import express from 'express';
import helmet from 'helmet';
import { Client, isGrpcServiceError } from '@temporalio/client';
import { createTemporalClientConnection } from './connection-client';
import { callbackSignal } from './signals';

// gRPC NOT_FOUND status code — thrown when signaling a workflow that no longer exists.
const GRPC_NOT_FOUND = 5;

// Temporal workflow IDs are free-form strings, but this endpoint is a public trust
// boundary — restrict to a conservative charset/length so malformed or oversized
// input can't reach the Temporal client unchecked.
const WORKFLOW_ID_PATTERN = /^[A-Za-z0-9_\-.:]{1,255}$/;

// Shared secret validated on every inbound callback. Set WEBHOOK_SECRET in the
// environment and configure the external provider (e.g. Carbon) to send it as
// `Authorization: Bearer <secret>`. Without it, any caller who learns a workflowId
// can inject a malicious callback result.
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
  console.warn(
    '[webhook] WEBHOOK_SECRET not set — /callback is unauthenticated. Do not run without it in production.'
  );
}

// Plain `===` leaks the secret one byte at a time via response-time differences.
// timingSafeEqual requires equal-length buffers, so the length check must happen
// first — but that check is on public info (length), not secret content, so it
// doesn't reintroduce a timing side-channel.
function isValidAuth(auth: string, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(auth);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

// express parses repeated query keys (`?workflowId=a&workflowId=b`) as an array;
// require exactly one string value so the pattern check below can't be bypassed
// by an array coercing to a comma-joined string.
function getWorkflowId(req: express.Request): string | undefined {
  const { workflowId } = req.query;
  return typeof workflowId === 'string' ? workflowId : undefined;
}

export function createWebhookApp(client: Pick<Client, 'workflow'>): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json());

  // Execution sequence for async providers:
  //   1. Worker runs workflow → schedules initiate() activity → Carbon API called
  //   2. Carbon API returns immediately; workflow suspends awaiting workflowCallback signal
  //   3. Carbon finishes work → POSTs here with workflowId
  //   4. This handler signals Temporal → resolves the Trigger in waitForCallback() (utils.ts)
  //   5. Worker picks up the resumed workflow task → workflow calls parseResult() activity
  //   6. Worker runs parseResult() → typed result returned → workflow completes
  //
  // This server and the domain worker never communicate directly — Temporal is the
  // intermediary. The server only needs the workflowId and the signal definition;
  // all domain logic stays in the worker.
  //
  // Deployment note: this server and domain workers have different scaling profiles.
  // The webhook server handles inbound HTTP and must be publicly reachable; workers scale
  // with workflow throughput. They can run in separate environments — the only shared
  // dependency is the Temporal client and the workflowCallback signal definition.
  app.post('/callback', async (req, res) => {
    const workflowId = getWorkflowId(req);
    console.log(
      '[webhook] POST /callback workflowId=%s body=%s',
      workflowId,
      JSON.stringify(req.body)
    );

    if (WEBHOOK_SECRET) {
      const auth = req.headers['authorization'];
      if (!auth || !isValidAuth(auth, WEBHOOK_SECRET)) {
        console.warn(
          '[webhook] 401 unauthorized workflowId=%s authProvided=%s',
          workflowId,
          Boolean(auth)
        );
        res.status(401).send('Unauthorized');
        return;
      }
    }

    if (!workflowId) {
      console.warn('[webhook] 400 missing workflowId');
      res.status(400).send('Missing required query param: workflowId');
      return;
    }

    if (!WORKFLOW_ID_PATTERN.test(workflowId)) {
      console.warn('[webhook] 400 malformed workflowId=%s', workflowId);
      res.status(400).send('Malformed workflowId');
      return;
    }

    try {
      await client.workflow.getHandle(workflowId).signal(callbackSignal, req.body);
      console.log('[webhook] signaled workflowId=%s', workflowId);
      res.sendStatus(200);
    } catch (err) {
      // Workflow already completed or timed out before the callback arrived.
      // Ack with 200 so the provider doesn't retry endlessly against a dead workflow.
      if (isGrpcServiceError(err) && err.code === GRPC_NOT_FOUND) {
        console.warn(
          '[webhook] workflow not found (already completed/timed out) workflowId=%s',
          workflowId
        );
        res.sendStatus(200);
        return;
      }
      console.error('[webhook] error signaling workflowId=%s', workflowId, err);
      res.sendStatus(502);
    }
  });

  return app;
}

async function main(): Promise<void> {
  const { connection, namespace } = await createTemporalClientConnection();
  const client = new Client({ connection, namespace });
  const app = createWebhookApp(client);

  const PORT = process.env.WEBHOOK_PORT ?? 3001;
  const server = app.listen(PORT, () => console.log(`Webhook server listening on :${PORT}`));

  const shutdown = () => {
    server.close();
    connection.close().catch((err: unknown) => {
      console.error('[webhook] error closing connection during shutdown:', err);
      process.exit(1);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

// Only auto-start when run directly (`ts-node src/core/webhook-server.ts`), not when
// imported for its createWebhookApp export (e.g. from tests).
if (require.main === module) {
  main().catch((err: unknown) => {
    console.error('[webhook] Fatal error:', err);
    process.exit(1);
  });
}
