#!/bin/sh
# Restores a dump over the PowerLoom database. Stop worker and web first:
#   docker compose stop worker web
#   docker compose run --rm backup sh /scripts/restore.sh /backups/<file>.dump
set -eu

file="${1:?usage: restore.sh /backups/<file>.dump}"

pg_restore -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner "$file"
echo "restored: $file"
