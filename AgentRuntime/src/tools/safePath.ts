import { isAbsolute, relative, resolve } from "node:path";

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
