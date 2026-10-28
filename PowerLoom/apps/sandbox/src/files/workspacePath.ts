import { posix } from "node:path";
import { WORKSPACE } from "@powerloom/sandbox";
import type { Outcome } from "../models/Outcome";

/** An agent's path as an absolute path inside the workspace: relative paths are below it, nothing may leave it. */
export function workspacePath(path: string): Outcome<string> {
  if (path.includes("\0") || path.trim().length === 0) {
    return { ok: false, reason: `"${path}" is not a path` };
  }

  const absolute = posix.normalize(posix.isAbsolute(path) ? path : posix.join(WORKSPACE, path));
  const resolved = absolute.length > 1 ? absolute.replace(/\/+$/, "") : absolute;
  const isInside = resolved === WORKSPACE || resolved.startsWith(`${WORKSPACE}/`);

  return isInside ? { ok: true, value: resolved } : { ok: false, reason: `${path} is outside ${WORKSPACE}: only files in the workspace can be changed` };
}
