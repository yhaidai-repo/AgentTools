import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { extractNotesSection } from "./notesSection";

// Writes inside one Vault folder only (a path that would leave it is refused). Files are rewritten only when content changes.
export class VaultWriter {
  constructor(private readonly root: string) {}

  async write(relativePath: string, render: (notesSection: string) => string): Promise<boolean> {
    const fullPath = this.pathOf(relativePath);
    const existing = await readIfExists(fullPath);
    const content = render(extractNotesSection(existing));

    if (content === existing) {
      return false;
    }

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf8");

    return true;
  }

  // Uploaded files never change once written, so an existing file is left alone.
  async writeOnce(relativePath: string, bytes: Buffer): Promise<boolean> {
    const fullPath = this.pathOf(relativePath);

    if (await exists(fullPath)) {
      return false;
    }

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, bytes);

    return true;
  }

  // Creates the file with the default content when missing; never overwrites a user-edited file.
  async readOrCreate(relativePath: string, defaultContent: string): Promise<string> {
    const fullPath = this.pathOf(relativePath);
    const existing = await readIfExists(fullPath);

    if (existing !== null) {
      return existing;
    }

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, defaultContent, "utf8");

    return defaultContent;
  }

  private pathOf(relativePath: string): string {
    return insideRoot(this.root, relativePath);
  }
}

function insideRoot(root: string, relativePath: string): string {
  const fullPath = resolve(root, relativePath);
  const fromRoot = relative(resolve(root), fullPath);

  if (fromRoot === "" || fromRoot.startsWith("..") || resolve(fromRoot) === fromRoot) {
    throw new Error(`Refused to write outside the Vault folder: ${relativePath}`);
  }

  return fullPath;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);

    return true;
  } catch {
    return false;
  }
}

async function readIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}
