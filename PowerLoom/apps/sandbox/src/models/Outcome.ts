// An expected failure (a patch that doesn't match, a path outside the workspace) is a value, not a throw.
export type Outcome<T> = { ok: true; value: T } | { ok: false; reason: string };
