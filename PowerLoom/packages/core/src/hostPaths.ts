import { posix } from "node:path";
import type { HostFolder } from "./models/HostFolder";

// A file the user names by its PC path (`D:\Claude\notes\spec.pdf`) as this container reads it, through the folders it
// mounts (the vaults root, the repos). Null for a path outside them, `..` escapes included.
export function containerPathOf(hostPath: string, folders: HostFolder[]): string | null {
  const path = normalized(hostPath);
  const folder = folders.find((candidate) => isInside(path, normalized(candidate.hostRoot)));

  if (!folder) {
    return null;
  }

  const relative = posix.normalize(path.slice(normalized(folder.hostRoot).length).replace(/^\/+/, ""));

  return relative.startsWith("..") ? null : posix.join(folder.mount, relative);
}

function normalized(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+$/, "");
}

// Windows paths compare without case (D:/Claude and d:/claude are one folder).
function isInside(path: string, root: string): boolean {
  const lowerPath = path.toLowerCase();
  const lowerRoot = root.toLowerCase();

  return root.length > 0 && (lowerPath === lowerRoot || lowerPath.startsWith(`${lowerRoot}/`));
}
