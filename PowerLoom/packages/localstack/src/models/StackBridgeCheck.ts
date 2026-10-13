// Settings' test of a vault's bridge: a failed check is an answer, not an error.
export interface StackBridgeCheck {
  ok: boolean;
  message: string;
}
