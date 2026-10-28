// How a writer's own output bears on its task's end, beyond write_result's status (user decision 2026-10-25: the task
// is settled once, after every writer committed, never by a writer): `missing` names the output the task promised and
// the run didn't produce; `waits` the items it wrote that the task waits for (a test's blocking items); `blocked` a reason
// the task can't go on that only a person settles (a cancelled review), whatever else the run did. Handing work on is a
// hand-off, which the settlement reads on its own (user decision 2026-10-28).
export type WriterSettlement =
  | { kind: "missing"; output: string }
  | { kind: "waits"; ids: string[]; reason: string }
  | { kind: "blocked"; reason: string };
