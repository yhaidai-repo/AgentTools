import type { PatchHunk } from "./PatchHunk";

export type PatchOperation =
  | { kind: "add"; path: string; lines: string[] }
  | { kind: "delete"; path: string }
  | { kind: "update"; path: string; moveTo: string | null; hunks: PatchHunk[] };
