# Temporal Platform

Core Temporal platform: cluster (Docker Compose locally), namespaces, worker/client harness, and a GitHub Actions pipeline. This repo does **not** contain business workflows/activities — those live in separate app repos that plug into this platform's worker via `TEMPORAL_APP_ENTRY`. `test/fixtures/greeting` is a minimal stand-in app used only to prove the platform harness works; it ships in no build artifact.

Runs entirely locally today (no Temporal Cloud subscription yet). `dev` and `prod` are both Temporal namespaces registered against the same local server — see [Namespaces](#namespaces) for how `prod` moves to real Temporal Cloud later with no code changes.

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

## Running against a real app

A real app repo publishes an npm package exporting `<package>/workflows` and `<package>/activities` subpaths (keep workflow and activity code in separate files/dirs, per Temporal SDK convention). Point the platform's worker at it:

```
TEMPORAL_APP_ENTRY=<npm-package-name> TEMPORAL_TASK_QUEUE=<queue> npm run worker
```

`src/worker/worker.ts` and `src/client/start-workflow.ts` never import app code directly — `TEMPORAL_APP_ENTRY` and `TEMPORAL_TASK_QUEUE` are the only integration points, and `start-workflow.ts` starts workflows by type name (string), not a typed function reference.

## Production builds

`npm run worker` bundles workflow code at startup, which is fine for local iteration but too slow for production. For a production-like run:

```
npm run build                                        # compiles src/ to dist/ (platform runtime only)
TEMPORAL_APP_ENTRY=<npm-package-name> npm run build:workflow-bundle   # pre-bundles the app's workflow code to dist/workflow-bundle.js
TEMPORAL_WORKER_MODE=production TEMPORAL_APP_ENTRY=<npm-package-name> TEMPORAL_TASK_QUEUE=<queue> npm run worker:prod
```

`TEMPORAL_WORKER_MODE=production` switches the worker from `workflowsPath` (bundles on every startup) to the pre-built `workflowBundle` — see `src/worker/worker.ts`. Activities are still `require()`'d directly at runtime in both modes, so the app package's compiled output (not raw TypeScript) must be resolvable via Node's module resolution in production.

## Namespaces

`docker/namespaces/dev.env` and `docker/namespaces/prod.env` hold everything that differs between namespaces: `TEMPORAL_NAMESPACE`, `TEMPORAL_ADDRESS`, and (blank today) `TEMPORAL_TLS_CERT_PATH` / `TEMPORAL_TLS_KEY_PATH` / `TEMPORAL_CLOUD_API_KEY`. `src/config/env.ts` is the only place that reads them.

Both namespaces are auto-registered on the local server by `temporal-admin-tools` (`scripts/register-namespaces.sh`) when the stack starts.

When the Temporal Cloud subscription is active, point `prod.env` (or CI/CD secrets) at the Cloud namespace address and add mTLS certs or an API key — no application code changes.

`prod.env` is gitignored once it holds anything real; `prod.env.example` is the committed template.

## Testing

`npm test` runs Jest against `@temporalio/testing`'s `TestWorkflowEnvironment.createLocal()` — a full local test server, no Docker required — using the `test/fixtures/greeting` fixture to prove the harness (worker + test environment wiring) itself works. (Time-skipping is only used when a workflow under test relies on timers, which the fixture does not.)

## CI

See `.github/workflows/ci.yml`: lint, typecheck, unit tests, build, a build-time check that the workflow-bundle mechanism works (against the fixture), compose config validation, and a full compose smoke test that runs the worker/client harness against both `dev` and `prod` namespaces on every PR (again using the fixture as a stand-in app).

`.github/workflows/release.yml` is a manual (`workflow_dispatch`) version bump + tag + draft GitHub release.

## Deploy

Not yet wired up — `deploy` job in `ci.yml` is a placeholder. Docker Compose is the deploy target for now; Kubernetes and Temporal Cloud are future work.
