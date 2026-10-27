import { access, appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { extractNotesSection } from "./notesSection";
import { scopedFilePath } from "./scopedFilePath";

// Writes inside one Vault folder only (a path that would leave it is refused). Files are rewritten only when content changes.
export class VaultWriter {
  constructor(private readonly root: string) {}

  async write(relativePath: string, render: (notesSection: string) => string): Promise<boolean> {
    const fullPath = await this.pathOf(relativePath);
    const existing = await readIfExists(fullPath);
    const content = render(extractNotesSection(existing));

    if (content === existing) {
      return false;
    }

    await mkdir(dirname(fullPath), { recursive: true });
    await this.pathOf(relativePath);
    await writeFile(fullPath, content, "utf8");

    return true;
  }

  // Uploaded files never change once written, so an existing file is left alone.
  async writeOnce(relativePath: string, bytes: Buffer): Promise<boolean> {
    const fullPath = await this.pathOf(relativePath);

    if (await exists(fullPath)) {
      return false;
    }

    await mkdir(dirname(fullPath), { recursive: true });
    await this.pathOf(relativePath);
    try { await writeFile(fullPath, bytes, { flag: "wx" }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return false; throw error; }

    return true;
  }

  async readText(relativePath: string): Promise<string | null> {
    return readIfExists(await this.pathOf(relativePath));
  }

  // A whole file as given (e.g. a docs-vault note the tech-writer merged); unchanged content isn't rewritten.
  async writeText(relativePath: string, content: string): Promise<boolean> {
    const fullPath = await this.pathOf(relativePath);

    if ((await readIfExists(fullPath)) === content) {
      return false;
    }

    await mkdir(dirname(fullPath), { recursive: true });
    await this.pathOf(relativePath);
    await writeFile(fullPath, content, "utf8");

    return true;
  }

  // Append-only publication keeps changes made since the caller read the note.
  async appendText(relativePath: string, content: string): Promise<void> {
    const fullPath = await this.pathOf(relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await this.pathOf(relativePath);
    await appendFile(fullPath, content, "utf8");
  }

  // A note whose item the user deleted; a file that is already gone is fine.
  async remove(relativePath: string): Promise<void> {
    await rm(await this.pathOf(relativePath), { force: true });
  }

  // A deleted PBI's folder with all its notes and attachments; the vault root itself is never removed.
  async removeFolder(relativePath: string): Promise<void> {
    if (!relativePath.replace(/[\\/.]/g, "")) {
      throw new Error("refusing to remove the vault root");
    }

    await rm(await this.pathOf(relativePath), { recursive: true, force: true });
  }

  // Creates the file with the default content when missing; never overwrites a user-edited file.
  async readOrCreate(relativePath: string, defaultContent: string): Promise<string> {
    const fullPath = await this.pathOf(relativePath);
    const existing = await readIfExists(fullPath);

    if (existing !== null) {
      return existing;
    }

    await mkdir(dirname(fullPath), { recursive: true });
    await this.pathOf(relativePath);
    try { await writeFile(fullPath, defaultContent, { encoding: "utf8", flag: "wx" }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      return (await readIfExists(await this.pathOf(relativePath))) ?? defaultContent;
    }

    return defaultContent;
  }

  private async pathOf(relativePath: string): Promise<string> {
    try { return (await scopedFilePath(this.root, relativePath)).path; }
    catch (error) { throw new Error(`Refused to access outside the Vault folder: ${relativePath}`, { cause: error }); }
  }
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
