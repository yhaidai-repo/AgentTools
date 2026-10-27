import { isAbsolute, relative, resolve } from "node:path";
import { realpath } from "node:fs/promises";

// Resolves a tool-supplied path inside `root`; rejects anything that escapes it (`..`, absolute paths).
export function resolveInside(root: string, path: string): string {
  const base = resolve(root);
  const target = resolve(base, path);
  const fromBase = relative(base, target);

  if (fromBase.startsWith("..") || isAbsolute(fromBase)) {
    throw new Error(`Path is outside the allowed folder: ${path}`);
  }

  return target;
}

export function toRelative(root: string, fullPath: string): string {
  return relative(resolve(root), fullPath).replaceAll("\\", "/");
}

// For existing read targets: lexical containment alone does not constrain symbolic links or junctions.
export async function resolveExistingInside(root: string, path: string): Promise<string> {
  const lexical = resolveInside(root, path);
  const [base, target] = await Promise.all([realpath(root), realpath(lexical)]);

  return resolveInside(base, relative(base, target));
}
