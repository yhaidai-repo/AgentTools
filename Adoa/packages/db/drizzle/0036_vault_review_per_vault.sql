-- A vault review schedule reviews its own vault (user decision 2026-10-06): the `vaults` parameter is gone.
UPDATE "task_schedule" SET "params" = "params" - 'vaults' WHERE "params" ? 'vaults';
