// What a "continue with agent" chat is opened on.
export type ChatTarget =
  | { kind: "pbi"; adoId: number }
  | { kind: "item"; itemId: string }
  | { kind: "review"; prId: number };
