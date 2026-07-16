# Temporal Platform

Core scaffold for our Temporal platform: local Docker Compose dev environment, TypeScript SDK workers/workflows, and a GitHub Actions pipeline.

Runs entirely locally today (no Temporal Cloud subscription yet). `dev` and `prod` are both Temporal namespaces registered against the same local server — see [Namespaces](#namespaces) for how `prod` moves to real Temporal Cloud later with no code changes.

## Quick start

```
cp .env.example .env   # already done in this repo; edit to change image versions
npm install
docker compose --project-directory . -f docker/docker-compose.yml -f docker/docker-compose.override.yml up -d
```

`--project-directory .` makes Compose read the root `.env` even though the compose files live under `docker/`.

Wait for the stack to become healthy (`docker compose --project-directory . -f docker/docker-compose.yml ps`), then run the sample workflow against the `dev` namespace:

```
set -a; . docker/namespaces/dev.env; set +a
npm run worker            # in one terminal
npm run start:greeting    # in another
```

Temporal Web UI: http://localhost:8080

## Namespaces

`docker/namespaces/dev.env` and `docker/namespaces/prod.env` hold everything that differs between namespaces: `TEMPORAL_NAMESPACE`, `TEMPORAL_ADDRESS`, and (blank today) `TEMPORAL_TLS_CERT_PATH` / `TEMPORAL_TLS_KEY_PATH` / `TEMPORAL_CLOUD_API_KEY`. `src/config/env.ts` is the only place that reads them.

Both namespaces are auto-registered on the local server by `temporal-admin-tools` (`scripts/register-namespaces.sh`) when the stack starts.

When the Temporal Cloud subscription is active, point `prod.env` (or CI/CD secrets) at the Cloud namespace address and add mTLS certs or an API key — no application code changes.

`prod.env` is gitignored once it holds anything real; `prod.env.example` is the committed template.

## Testing

`npm test` runs Jest against `@temporalio/testing`'s time-skipping test environment — no Docker required.

## CI

See `.github/workflows/ci.yml`: lint, typecheck, unit tests, build, compose config validation, and a full compose smoke test that runs the sample workflow against both `dev` and `prod` namespaces on every PR.

`.github/workflows/release.yml` is a manual (`workflow_dispatch`) version bump + tag + draft GitHub release.

## Deploy

Not yet wired up — `deploy` job in `ci.yml` is a placeholder. Docker Compose is the deploy target for now; Kubernetes and Temporal Cloud are future work.
