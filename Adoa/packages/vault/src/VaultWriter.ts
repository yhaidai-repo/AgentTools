import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { extractNotesSection } from "./notesSection";

// Only the worker writes the Vault. Files are rewritten only when content changes.
export class VaultWriter {
  constructor(private readonly root: string) {}

  async write(relativePath: string, render: (notesSection: string) => string): Promise<boolean> {
    const fullPath = join(this.root, relativePath);
    const existing = await readIfExists(fullPath);
    const content = render(extractNotesSection(existing));

    if (content === existing) {
      return false;
    }

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf8");

    return true;
  }

  // Creates the file with the default content when missing; never overwrites a user-edited file.
  async readOrCreate(relativePath: string, defaultContent: string): Promise<string> {
    const fullPath = join(this.root, relativePath);
    const existing = await readIfExists(fullPath);

    if (existing !== null) {
      return existing;
    }

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, defaultContent, "utf8");

    return defaultContent;
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
