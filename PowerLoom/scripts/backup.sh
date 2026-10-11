#!/bin/sh
# One dump of the PowerLoom database into /backups; deletes dumps older than BACKUP_KEEP_DAYS.
set -eu

stamp=$(date +%Y%m%d-%H%M)
file="/backups/powerloom-$stamp.dump"

pg_dump -h db -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$file.part"
mv "$file.part" "$file"
find /backups -name '*.dump' -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete

echo "backup written: $file"
