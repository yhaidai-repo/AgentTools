// What a flow runs for: a PBI of the vault, or one of its tasks.
export type FlowTarget =
  | { kind: "pbi"; pbiId: number }
  | { kind: "task"; itemId: string };
