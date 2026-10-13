// Where the rendered backlogs of all vaults are mounted in this container (read-only for the web).
export function backlogMount(): string {
  return process.env.BACKLOG_MOUNT ?? "/vault";
}
