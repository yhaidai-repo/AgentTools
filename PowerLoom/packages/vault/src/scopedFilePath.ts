import { lstat, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";

// Resolve the nearest existing ancestor too: new files/directories must not acquire authority through a link.
export async function scopedFilePath(root: string, path: string): Promise<{ path: string; canonical: string; root: string }> {
  const base = resolve(root);
  const target = resolve(base, path);
  assertChild(base, target);
  const [canonicalRoot, canonical] = await Promise.all([canonicalPath(base), canonicalPath(target)]);
  assertChild(canonicalRoot, canonical);
  // Keep the lexical path for I/O so removing an allowed in-root symlink removes the link, not its target.
  return { path: target, canonical, root: canonicalRoot };
}

function assertChild(root: string, target: string): void {
  const child = relative(root, target);
  if (!child || child === ".." || child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(child)) throw new Error("Path is outside the allowed folder or names its root.");
}

async function canonicalPath(path: string): Promise<string> {
  const missing: string[] = [];
  let current = path;
  for (;;) {
    const info = await lstat(current).catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw error; });
    if (info) return join(await realpath(current), ...missing.reverse());
    const parent = dirname(current);
    if (parent === current) throw new Error("No existing ancestor for path.");
    missing.push(basename(current));
    current = parent;
  }
}
