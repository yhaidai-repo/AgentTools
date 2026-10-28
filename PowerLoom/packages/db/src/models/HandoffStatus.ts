// A hand-off is open until its target closes in any way; a database trigger keeps it in step with the target's status.
export type HandoffStatus = "open" | "closed";
