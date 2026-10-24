// DevHub's answer: the value, or why not. `denied` = DevHub refused the token.
export type DevHubAnswer<T> = { ok: true; value: T } | { ok: false; message: string; denied: boolean };
