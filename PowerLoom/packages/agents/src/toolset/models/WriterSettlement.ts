// How a writer's own output bears on its task's end, beyond write_result's status (user decision 2026-10-25: the task
// is settled once, after every writer committed, never by a writer): `missing` names the output the task promised and
// the run didn't produce; `waits` the items it wrote that the task waits for, instead of every task the run created;
// `handedOn` the follow-up task that carries the work on, so this one ends done.
export type WriterSettlement =
  | { kind: "missing"; output: string }
  | { kind: "waits"; ids: string[]; reason: string }
  | { kind: "handedOn"; id: string };
