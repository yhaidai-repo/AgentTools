// A one-off action on one PBI that needs the worker (the ADO token, the backlog vault): sent only by the user's buttons.
export interface PbiJob {
  action: "sync" | "delete";
  adoId: number;
}
