# spec-00 — Platform Foundation

**Status:** Implemented
**Scope:** Everything present in the repository at the time this spec was
written — the Temporal platform foundation. This spec is a retrospective record
of the requirements the current code satisfies, so later work has a baseline to
extend.

## Goal

Provide a reusable Temporal platform for CHG that owns the cluster, namespaces,
connection/namespace plumbing, a generic worker/client harness, callback and
update helpers, a shared webhook relay, Effect-activity bridging, and a CI/CD
pipeline — **without** hosting any business workflows or activities. Domain
repos own their own workflows/activities and either plug into the generic
harness or build their own worker/client on this package's exported helpers.

## Non-goals

- Business/domain workflows and activities (live in separate domain repos).
- Automated rollout to a running host or cluster (pipeline stops at publishing
  a deployable image; no cloud target is provisioned).
- Kubernetes manifests and Temporal Cloud provisioning (future work).

## Requirements

### REQ-00-1 — Platform hosts no domain workflows/activities

The `src/` tree contains only platform code (connections, worker/client
harness, helpers, webhook relay). Workflow/activity code exists solely under
`test/fixtures/greeting` as a harness stand-in and is excluded from the build
(`tsconfig.build.json`) and the Docker image (`.dockerignore`). Domain repos
supply their workflows/activities via `TEMPORAL_APP_ENTRY` or by importing this
package's helpers.

### REQ-00-2 — Local cluster via Docker Compose

`docker/docker-compose.yml` brings up a complete local Temporal stack:
PostgreSQL, Elasticsearch (visibility), `temporalio/auto-setup`, admin-tools,
the Web UI, and the webhook relay. Service versions are pinned via the root
`.env`. Health checks gate dependent services. `docker-compose.override.yml`
exposes Postgres/Elasticsearch ports for local debugging.

### REQ-00-3 — dev and prod namespaces

Both `dev` and `prod` namespaces are auto-registered on the local server at
startup by `scripts/register-namespaces.sh` (via the `temporal-admin-tools`
service), idempotently. Per-namespace connection config lives in
`docker/namespaces/dev.env` and `docker/namespaces/prod.env` (the latter
gitignored once it holds real secrets; `prod.env.example` is the committed
template).

### REQ-00-4 — envconfig-driven connections, no hardcoded namespace

`createTemporalClientConnection` and `createTemporalNativeConnection`
(`src/core/`) both resolve address, TLS/mTLS, API key, and namespace from
`@temporalio/envconfig`'s `loadClientConnectConfig()`. The same env var names
work unchanged against local Docker and Temporal Cloud with no code change. The
resolved namespace is returned alongside the connection so callers never
hardcode `'default'`.

### REQ-00-5 — Generic worker harness

`src/worker/worker.ts` runs a worker for any app package/path given via
`TEMPORAL_APP_ENTRY` + `TEMPORAL_TASK_QUEUE`, importing its `workflows`/
`activities` subpaths. In `production` mode it loads a pre-built workflow
bundle; in dev mode it bundles `workflowsPath` at startup. `startWorker`
wraps connection + `Worker.create` + graceful `SIGINT`/`SIGTERM` shutdown.

### REQ-00-6 — Generic workflow starter client

`src/client/start-workflow.ts` starts any workflow by string type name (the
platform cannot import typed domain functions), with a generated workflow ID
and JSON args, against the configured namespace/task queue.

### REQ-00-7 — Workflow-safe export boundary

Workflow-context code imports from the `@chg/temporal-platform/workflow`
subpath (`src/core/workflow-exports.ts`), which only pulls in
`@temporalio/workflow`. The main entry (`src/index.ts`) is banned from workflow
code because it imports `@temporalio/client`/`@temporalio/worker`. An ESLint
override (`.eslintrc.cjs`) forbids Node builtins and non-bundle-safe packages in
workflow files, enforced in CI.

### REQ-00-8 — Callback (webhook) pattern

`waitForCallback` (`src/core/utils.ts`) registers the shared `callbackSignal`
handler synchronously before any await (so a fast callback isn't dropped) and
races it against a timeout. It is single-use per execution, guarded by a bounded
FIFO of run IDs. The shared `src/core/webhook-server.ts` relay receives
`POST /callback?workflowId=...` from an external provider and signals the raw
body to the waiting workflow; it holds no domain logic.

### REQ-00-9 — Webhook relay is hardened

The relay: validates a `Bearer` shared secret with a constant-time comparison
(`timingSafeEqual`); warns loudly when `WEBHOOK_SECRET` is unset; constrains
`workflowId` to a conservative charset/length; rejects array-valued query
params; sets security headers via `helmet` and disables `x-powered-by`;
acknowledges `NOT_FOUND` (completed/expired workflow) with 200 so providers stop
retrying; and shuts down gracefully.

### REQ-00-10 — Update (request/reply) pattern

`waitForUpdate` (`src/core/updates.ts`) is the Update analogue of
`waitForCallback`: it registers the update handler before any await, resolves a
trigger with the caller's args, computes the reply (sync or async), and races
against a timeout.

### REQ-00-11 — Timeout/continue-as-new helper

`raceWithTimeout` (`src/core/wait-with-timeout.ts`), shared by the callback and
update helpers, throws a **non-retryable** `ApplicationFailure` on timeout,
logs a warning when `continueAsNewSuggested` is set (history growth), and logs a
cancellation-specific message when the workflow is cancelled mid-wait.

### REQ-00-12 — Effect-activity bridging

`makeActivities` (`src/core/connection-worker.ts`) converts a module of
Effect-returning activities into the Promise-returning shape `Worker.create`
expects, running each Effect on a supplied `ManagedRuntime`.
`proxyActivitiesEffect` (`src/core/proxy.ts`) is a typed activity proxy for
those modules that **requires** an explicit timeout and an explicit retry
policy (refusing to silently inherit the server default), and supports
per-call option overrides that replace (not concatenate) array fields.

### REQ-00-13 — Search-attribute registration

`registerSearchAttributes` (`src/core/search-attributes.ts`) registers custom
search attributes against a required, explicit namespace via the operator
service, mapping friendly type names to proto enums, and swallows
`ALREADY_EXISTS` (matched by gRPC status code) so re-running at startup is safe.

### REQ-00-14 — Replay/versioning safety helper

`runReplayFixture` (`src/core/testing.ts`, exported via the `/testing` subpath)
replays a recorded history proto against workflow code and fails on
non-determinism, guarding against breaking in-flight workflows when workflow
code changes.

### REQ-00-15 — Package export surface

`package.json` exposes three entry points: `.` (non-workflow code), `./workflow`
(bundle-safe workflow code), and `./testing`. `effect` and all `@temporalio/*`
packages are pinned to exact versions; consumers must pin the identical versions
(branded types break structural compatibility across drifting copies).

### REQ-00-16 — CI quality gates

`.github/workflows/ci.yml` runs, on PR and push to `main`: lint, Prettier
format check, typecheck, unit tests, build, a workflow-bundle build check
(against the fixture), compose config validation, a full compose smoke test that
exercises the worker/client harness against **both** dev and prod namespaces,
and an optional cross-repo integration smoke test against
`credentialing-domain-poc` (gated on the `CARBON_AUTH` secret via a dedicated
gate job, since the `secrets` context is unavailable in a job-level `if:`).

### REQ-00-17 — Unit tests without Docker

`npm test` runs Jest against `@temporalio/testing`'s
`TestWorkflowEnvironment.createLocal()` (embedded server, no Docker). Every
`src/core/*` module and the greeting harness fixture are covered
(39 tests at time of writing).

### REQ-00-18 — Deployment pipeline

On every green push to `main`, `ci.yml`'s `publish-image` job builds the
webhook-relay `Dockerfile` and pushes `:latest` + `:<sha>` tags to GHCR
(`ghcr.io/<owner>/temporal-platform-webhook`), after the compose smoke test
passes. `release.yml` (`workflow_dispatch`) bumps the version, tags, drafts a
GitHub release, and publishes an immutable `:v<version>` image tag. Rollout to a
running host/cluster is intentionally out of scope (see Non-goals).

### REQ-00-19 — Runtime container image

`Dockerfile` is a multi-stage build: a build stage compiles `src/` to `dist/`;
a slim runtime stage installs production dependencies only (`npm ci --omit=dev`)
and runs the webhook relay. `.dockerignore` keeps `test/`, `scripts/`,
`docker/`, and secrets out of the build context.

## Verification

- `npm run lint && npm run format:check && npm run typecheck && npm test` — all
  green (39 tests passing).
- `docker compose --project-directory . -f docker/docker-compose.yml config -q`
  — compose config validates.
- CI exercises the harness against dev and prod namespaces end-to-end.

## Known follow-ups (not in this spec)

- Automated rollout of the published image to a host/cluster.
- Kubernetes manifests; Temporal Cloud namespace provisioning.
- Task Queue priority/fairness for multi-tenant/multi-domain workloads.
- Revisit the tracked root `.env` (local-dev Docker credentials only) if any
  real secret ever needs to live there.
