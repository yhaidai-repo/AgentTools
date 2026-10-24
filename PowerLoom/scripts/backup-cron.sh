#!/bin/sh
# Backup service entrypoint: one dump at start, then on BACKUP_CRON (UTC).
set -eu

sh /scripts/backup.sh
echo "${BACKUP_CRON:-0 2 * * *} sh /scripts/backup.sh >> /proc/1/fd/1 2>&1" | crontab -
exec crond -f -l 8
