# PowerLoom

The .NET backend taking over adoa's worker jobs feature by feature. Design and status: the `adoa` vault
(`adoa-wolverine-target`, `adoa-backend-slices`, `adoa-backend-endpoints`, `adoa-backend-delivery`).

| Project | Role |
|---|---|
| `src/PowerLoom.Api` | the executable: `Program.cs` only |
| `src/PowerLoom.Core` | features (vertical slices) and infrastructure; `[assembly: WolverineModule]`, `[assembly: JasperFxAssembly]` |
| `src/PowerLoom.Persistence` | EF Core model of adoa's schema (entities, one configuration per table, enums), migrations |
| `src/PowerLoom.Contracts` | messages and types shared across projects |
| `tests/PowerLoom.Api.Tests` | Alba + Testcontainers (one host and Postgres per run) |

## Run locally
Settings come from the environment (they override `appsettings.Development.json`):
`ConnectionStrings__PowerLoom`, `Vaults__Root`, optionally `OTEL_EXPORTER_OTLP_ENDPOINT`.

```bash
dotnet run --project src/PowerLoom.Api
```

## Commands (`dotnet run --project src/PowerLoom.Api -- <command>`)
| Command | Does |
|---|---|
| `describe` | Wolverine's endpoints, queues and handlers |
| `codegen write` | writes Wolverine's handler code to `src/PowerLoom.Api/Internal/Generated` (the Docker build does this; no database needed) |
| `openapi-write ../../openapi/PowerLoom.Api.json` | writes the OpenAPI document; then `npm run openapi -w @adoa/web` regenerates the web's typed client |

## Schema
PowerLoom owns adoa's `public` schema through EF Core migrations, applied at start (`DatabaseMigrator`). A database
drizzle built is adopted once: the baseline is recorded as applied.

```bash
dotnet tool run dotnet-ef migrations add <Name> --project src/PowerLoom.Persistence --startup-project src/PowerLoom.Persistence --output-dir Migrations
```

To check a migration against a live database, apply the migrations to a scratch database and diff
`pg_dump --schema-only -n public` of both through `scripts/normalize-schema-dump.py`.
