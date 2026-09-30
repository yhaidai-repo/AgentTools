# adoa

Azure DevOps agent pipeline. Design notes: personal docs vault `D:/Claude/personal-projects/adoa` (entry `adoa-index`).

## Status
Phase 1: Docker Compose + database only.

## Run
```bash
cp .env.example .env      # set POSTGRES_PASSWORD
docker compose up -d      # db + one-shot migrate
```
- DB on `127.0.0.1:${DB_PORT}` (default 5442; 5432 is often taken by a local Postgres).
- `docker compose run --rm migrate` re-applies pending migrations.

## Schema changes
1. Edit `packages/db/src/schema.ts`.
2. `cd packages/db && npx drizzle-kit generate --name <change>`
3. `docker compose run --rm --build migrate`

## Notes
- Node images set `NODE_OPTIONS=--no-network-family-autoselection`: Node's connection racing times out on this Docker network (npm ETIMEDOUT).
