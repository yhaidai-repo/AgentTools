import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";

// Only Markdown files explicitly linked by the loaded SKILL.md, contained in that skill's own folder.
// Preload approved references; use_skill never becomes a general filesystem reader.
export async function skillReferences(skillPath: string, body: string): Promise<{ files: Record<string, string>; unavailable: string[] }> {
  const files: Record<string, string> = {}, unavailable: string[] = [];
  const root = await realpath(dirname(skillPath)).catch(() => null);
  const names = new Set<string>();
  for (const match of body.matchAll(/\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g)) {
    let name: string;
    try { name = decodeURIComponent((match[1] ?? match[2]).split("#")[0]).replace(/^\.\//, ""); } catch { continue; }
    if (!/^(?:[a-zA-Z0-9_. -]+\/)*[a-zA-Z0-9_. -]+\.md$/i.test(name) || name.split("/").some(part => part === "." || part === "..") || name === "SKILL.md") continue;
    names.add(name);
  }
  let bytes = 0;
  for (const name of names) {
    try {
      if (!root) throw new Error("Skill folder unavailable");
      if (Object.keys(files).length >= 20) throw new Error("Too many references");
      const path = await realpath(join(root, name));
      const within = relative(root, path);
      if (isAbsolute(within) || within === ".." || within.startsWith(".." + sep)) throw new Error("Outside skill folder");
      const info = await stat(path);
      if (!info.isFile() || info.size > 128 * 1024 || bytes + info.size > 1024 * 1024) throw new Error("Reference too large");
      const content = await readFile(path, "utf8");
      const size = Buffer.byteLength(content);
      if (size > 128 * 1024 || bytes + size > 1024 * 1024) throw new Error("Reference grew too large");
      files[name] = content;
      bytes += size;
    } catch { unavailable.push(name); }
  }
  return { files, unavailable };
}
