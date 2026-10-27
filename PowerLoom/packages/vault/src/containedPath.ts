import { realpath } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";

// Resolve both ends before access: a symlink or Windows junction must not expand a mounted folder's authority.
export async function containedPath(root: string, target: string): Promise<string | null> {
  try {
    const [base, path] = await Promise.all([realpath(root), realpath(target)]);
    const child = relative(base, path);
    return child !== ".." && !child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && !isAbsolute(child) ? path : null;
  } catch {
    return null;
  }
}
