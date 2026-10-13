// The stack bridge's answer: the value, or why not. `denied` = the bridge refused the token.
export type BridgeAnswer<T> = { ok: true; value: T } | { ok: false; message: string; denied: boolean };
