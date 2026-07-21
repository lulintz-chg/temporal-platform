# Temporal Platform

Core Temporal platform for CHG: cluster (Docker Compose locally), namespaces, a
generic worker/client harness, a shared webhook relay, Effect-activity
bridging, and a GitHub Actions pipeline. This repo does **not** contain
business workflows/activities — those live in separate domain repos (e.g.
[`credentialing-domain-poc`](https://github.com/lulintz-chg/credentialing-domain-poc))
that either plug into this platform's generic worker via `TEMPORAL_APP_ENTRY`,
or import this package's helpers directly to build their own worker/client.
`test/fixtures/greeting` is a minimal stand-in app used only to prove the
generic harness works; it ships in no build artifact.

Namespace connections go through `@temporalio/envconfig`, so the same env vars
(`TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TEMPORAL_API_KEY` or
`TEMPORAL_TLS_CLIENT_CERT_*`/`TEMPORAL_TLS_CLIENT_KEY_*`) work unchanged
against local Docker today and Temporal Cloud once purchased — see
[Namespaces](#namespaces).

## Quick start

```
cp .env.example .env   # already done in this repo; edit to change image versions
npm install
docker compose --project-directory . -f docker/docker-compose.yml -f docker/docker-compose.override.yml up -d
```

`--project-directory .` makes Compose read the root `.env` even though the compose files live under `docker/`.

Wait for the stack to become healthy (`docker compose --project-directory . -f docker/docker-compose.yml ps`), then run the worker/client harness against the `dev` namespace using the `greeting` test fixture as a stand-in app:

```
set -a; . docker/namespaces/dev.env; set +a
TEMPORAL_APP_ENTRY="$(pwd)/test/fixtures/greeting" TEMPORAL_TASK_QUEUE=greeting-task-queue npm run worker   # one terminal
TEMPORAL_TASK_QUEUE=greeting-task-queue npm run start:workflow -- greetingWorkflow '["World"]'              # another
```

Temporal Web UI: http://localhost:18080

## What this package exports

**Non-workflow code** (workers, clients, scripts) — import from `@chg/temporal-platform`:

```typescript
import {
  // Connections — both read the same envconfig source (address, TLS, mTLS, Temporal Cloud)
  createTemporalClientConnection, // gRPC Connection for Client (scripts, webhook server)
  createTemporalNativeConnection, // NativeConnection for Worker (Rust-backed, required by Worker.create)

  // Worker — always import Worker from here, not @temporalio/worker directly
  Worker, // re-export; ensures single native module instance
  startWorker, // convenience wrapper for simple workers (no pre-startup steps)
  buildWorkflowBundle, // pre-bundle workflow code for production

  // Activity bridging
  makeActivities, // bridges Effect-returning activities → Promise shape for Worker.create

  // Other
  proxyActivitiesEffect, // typed proxy for Effect-returning activity modules
  registerSearchAttributes, // idempotent custom SA registration
} from '@chg/temporal-platform';

import type { InitiateResult, EffectActivities } from '@chg/temporal-platform';
```

**Workflow code only** — import from `@chg/temporal-platform/workflow` (this
subpath only imports `@temporalio/workflow`, which is safe inside a workflow
bundle's V8 sandbox — the main entry above pulls in `@temporalio/client` and
`@temporalio/worker`, both banned there):

```typescript
import {
  callbackSignal, // signal definition (also used by the webhook server)
  waitForCallback, // registers signal handler + races against timeout
  waitForUpdate, // same pattern for Temporal Updates (request/reply)
  defineUpdate, // re-export of @temporalio/workflow defineUpdate
  proxyActivitiesEffect,
} from '@chg/temporal-platform/workflow';
```

**Test code** — import from `@chg/temporal-platform/testing`:

```typescript
import { runReplayFixture } from '@chg/temporal-platform/testing';
```

Full integration walkthrough (activities, workflow function, worker, client,
the callback/webhook pattern, Temporal Updates, search attributes, namespace
and task-queue naming conventions): see the source docstrings in `src/core/`
and the [credentialing-domain-poc](https://github.com/lulintz-chg/credentialing-domain-poc)
reference implementation, which builds its license-renewal workflow on exactly
this package.

## Version pinning across repos

This repo and its domain consumers are separate git repos, not an npm/yarn
workspace — a `file:` dependency gets its own independently-installed
`node_modules`, so nothing hoists or dedupes automatically. `effect`'s
`Effect<>` type and `@temporalio/*`'s protobuf-generated types are branded in
a way that breaks structural compatibility across two different installed
copies of the _same_ version if a caret range lets them drift (e.g. `3.21.4`
vs `3.22.0`). Consequence: `effect` and every `@temporalio/*` package are
pinned to **exact** versions (no `^`) in this repo's `package.json`, and
domain repos consuming `@chg/temporal-platform` must pin the identical exact
versions themselves — see `credentialing-domain-poc/package.json`. Bumping
any of these here requires bumping them identically in every consumer repo.

## Two ways to run a domain against this platform

1. **Generic harness** (`src/worker/worker.ts` + `src/client/start-workflow.ts`,
   driven by `TEMPORAL_APP_ENTRY`/`TEMPORAL_TASK_QUEUE`) — for apps with plain
   Promise-returning activities and no pre-startup work. Never imports app
   code directly; `start-workflow.ts` starts workflows by type name (string),
   not a typed function reference.
2. **Your own worker/client**, built on this package's exported helpers
   (`createTemporalNativeConnection`, `makeActivities`, `Worker`, etc.) — for
   domains needing Effect-activity bridging, a custom `ManagedRuntime`, or
   other pre-startup work. `credentialing-domain-poc` uses this pattern.

Either way, domain repos own their workflows/activities; this repo owns the
cluster, the connection/namespace plumbing, and the shared webhook relay.

## Production builds

`npm run worker` bundles workflow code at startup, which is fine for local iteration but too slow for production. For a production-like run:

```
npm run build                                        # compiles src/ to dist/ (platform runtime only)
TEMPORAL_APP_ENTRY=<npm-package-name> npm run build:workflow-bundle   # pre-bundles the app's workflow code to dist/workflow-bundle.js
TEMPORAL_WORKER_MODE=production TEMPORAL_APP_ENTRY=<npm-package-name> TEMPORAL_TASK_QUEUE=<queue> npm run worker:prod
```

`TEMPORAL_WORKER_MODE=production` switches the worker from `workflowsPath` (bundles on every startup) to the pre-built `workflowBundle` — see `src/worker/worker.ts`. Activities are still `require()`'d directly at runtime in both modes, so the app package's compiled output (not raw TypeScript) must be resolvable via Node's module resolution in production.

## Webhook relay

`src/core/webhook-server.ts` is the shared relay for callback-driven domain
workflows (see `waitForCallback` above): it receives `POST /callback?workflowId=...`
from an external provider and signals the raw body to the waiting workflow —
no domain logic lives in it. Domain repos never run their own webhook server;
they point their provider's callback URL at this one.

```
npm run webhook                 # ts-node, local dev
```

Or as a container — the `webhook` service in `docker/docker-compose.yml`,
built from this repo's `Dockerfile`. Configure via `WEBHOOK_PORT` and
`WEBHOOK_SECRET` (root `.env`/`.env.example`); without `WEBHOOK_SECRET` set,
`/callback` is unauthenticated — do not run that way in production.

## Namespaces

`docker/namespaces/dev.env` and `docker/namespaces/prod.env` hold everything that differs between namespaces: `TEMPORAL_NAMESPACE`, `TEMPORAL_ADDRESS`, and (blank today) `TEMPORAL_API_KEY` / `TEMPORAL_TLS_CLIENT_CERT_PATH` / `TEMPORAL_TLS_CLIENT_KEY_PATH`. These are the exact variable names read by `@temporalio/envconfig`'s `loadClientConnectConfig()` (`src/core/connection-client.ts`, `src/core/connection-worker.ts`) — no custom parsing layer.

Both namespaces are auto-registered on the local server by `temporal-admin-tools` (`scripts/register-namespaces.sh`) when the stack starts.

When the Temporal Cloud subscription is active, point `prod.env` (or CI/CD secrets) at the Cloud namespace address and add mTLS certs or an API key — no application code changes.

`prod.env` is gitignored once it holds anything real; `prod.env.example` is the committed template.

All domains sharing a namespace should follow consistent task-queue/workflow-ID/search-attribute naming conventions (prefix with the domain) to avoid collisions — see `credentialing-domain-poc`'s `LICENSE_TASK_QUEUE`/`license-renewal-*` for the pattern.

## Testing

`npm test` runs Jest against `@temporalio/testing`'s `TestWorkflowEnvironment.createLocal()` — a full local test server, no Docker required. This covers both the `test/fixtures/greeting` harness fixture and unit tests for every `src/core/*` module (connections, signals, updates, proxy, webhook relay, search attributes, replay-fixture testing helper).

## CI

See `.github/workflows/ci.yml`: lint, typecheck, unit tests, build, a build-time check that the workflow-bundle mechanism works (against the fixture), compose config validation, a full compose smoke test that runs the worker/client harness against both `dev` and `prod` namespaces, and a cross-repo smoke test that checks out `credentialing-domain-poc` and runs its real license-renewal workflow against this platform's stack.

`.github/workflows/release.yml` is a manual (`workflow_dispatch`) version bump + tag + draft GitHub release.

## Deploy

The deployment pipeline publishes the webhook-relay container image to GitHub
Container Registry (GHCR):

- Every green push to `main` → `publish-image` job in `ci.yml` builds `Dockerfile`
  and pushes `ghcr.io/<owner>/temporal-platform-webhook:latest` and `:<sha>`
  (only after the full compose smoke test passes).
- A `workflow_dispatch` release (`release.yml`) additionally pushes an immutable
  `:v<version>` tag a deploy target can pin to.

Rolling those images onto a host/cluster (docker compose `pull && up -d`, or a
Kubernetes image bump) is the consuming step and is not yet automated — no cloud
target is provisioned. Publishing the versioned image is the boundary this
platform owns today; Kubernetes and Temporal Cloud rollout are future work.
