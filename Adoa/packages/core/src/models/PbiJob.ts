// A one-off action on one PBI that needs the worker (the ADO token, the backlog vault): sent only by the user's buttons.
// refresh: statuses and notes now, e.g. the handoff note "Continue with Claude" opens the chat on.
export interface PbiJob {
  action: "sync" | "delete" | "refresh";
  adoId: number;
  vault?: string; // sync: the vault the PBI joins (the one selected when the user asked)
}
