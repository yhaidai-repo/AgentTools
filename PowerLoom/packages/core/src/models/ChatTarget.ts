// What a "continue with agent" chat is opened on.
export type ChatTarget =
  | { kind: "pbi"; adoId: number }
  | { kind: "item"; itemId: string }
  | { kind: "review"; prId: number }
  | { kind: "vault"; vault: string } // configure a vault on the PC (user decision 2026-10-06)
  | { kind: "import"; vault: string; folder: string }; // bring a folder of the PC into the vault, with a report
