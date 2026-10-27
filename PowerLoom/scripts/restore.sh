#!/bin/sh
# Offline restore from a trusted pg_dump archive. Stop every current writer first:
#   docker compose stop powerloom agent-runner mcp web
#   docker compose run --rm --entrypoint sh backup /scripts/restore.sh /backups/<file>.dump
# On success: start API with --wait (migrations), then agent-runner, mcp and web.
# No success is reported after an SQL or connection-recovery failure. SQL changes are one transaction.
set -eu

file="${1:?usage: restore.sh /backups/<file>.dump}"
: "${POSTGRES_USER:?POSTGRES_USER is required}" "${POSTGRES_DB:?POSTGRES_DB is required}"
host="${PGHOST:-db}"
export PGHOST="$host"
[ -f "$file" ] && [ -r "$file" ] || { echo "Dump is not a readable file: $file" >&2; exit 1; }
[ "$POSTGRES_DB" != template1 ] || { echo 'template1 is reserved for connection recovery.' >&2; exit 1; }

work=$(mktemp -d /tmp/powerloom-restore.XXXXXX)
export POWERLOOM_RESTORE_MARKER="$work/owned"
completed=0
finish() {
    code=$?
    trap - EXIT HUP INT TERM
    # Only the restore session that acquired ownership may restore the original (enabled) connection state.
    if [ -f "$POWERLOOM_RESTORE_MARKER" ]; then
        if ! psql -X -h "$host" -U "$POSTGRES_USER" -d template1 -v ON_ERROR_STOP=1 -v "target=$POSTGRES_DB" <<'SQL'
ALTER DATABASE :"target" ALLOW_CONNECTIONS true;
SQL
        then
            echo 'Connection recovery failed: leave application writers stopped and repair ALLOW_CONNECTIONS from template1 before use.' >&2
            code=1
        fi
    fi
    rm -f "$work/restore.sql" "$POWERLOOM_RESTORE_MARKER"
    rmdir "$work"
    if [ "$code" -eq 0 ] && [ "$completed" -eq 1 ]; then echo "restored: $file"; fi
    exit "$code"
}
trap finish EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# Fully decode/validate the archive before changing the target or its connection state.
pg_restore --clean --if-exists --no-owner --exit-on-error --file="$work/restore.sql" "$file"

# Keep this session open while excluding new connections. A session advisory lock serializes restorers;
# existing writers are refused, never terminated. A failed SQL statement rolls the transaction back on exit.
PGAPPNAME=powerloom-restore psql -X -h "$host" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v "target=$POSTGRES_DB" -v "dump_sql=$work/restore.sql" <<'SQL'
SELECT pg_try_advisory_lock(1648167082, 1) AS acquired \gset
\if :acquired
\else
    DO $$ BEGIN RAISE EXCEPTION 'Another restore owns this database; no restore started.'; END $$;
\endif
SELECT datallowconn AS was_enabled FROM pg_database WHERE datname = current_database() \gset
\if :was_enabled
\else
    DO $$ BEGIN RAISE EXCEPTION 'Database connections were already disabled; prior state preserved.'; END $$;
\endif
\! touch "$POWERLOOM_RESTORE_MARKER"
\if :SHELL_ERROR
    DO $$ BEGIN RAISE EXCEPTION 'Could not persist restore ownership; no restore started.'; END $$;
\endif
\! printf '%s\n' 'ALTER DATABASE :"target" ALLOW_CONNECTIONS false;' | psql -X -h "$PGHOST" -U "$POSTGRES_USER" -d template1 -v ON_ERROR_STOP=1 -v "target=$POSTGRES_DB"
\if :SHELL_ERROR
    DO $$ BEGIN RAISE EXCEPTION 'Could not exclude new connections; no restore started.'; END $$;
\endif
SELECT NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()) AS quiet \gset
\if :quiet
\else
    DO $$ BEGIN RAISE EXCEPTION 'Active database clients remain. Stop powerloom, agent-runner, mcp, web and other clients before restoring.'; END $$;
\endif
BEGIN;
\i :dump_sql
COMMIT;
SQL
completed=1
