import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ImportSourceStatus, Outcome, PbiImportRequest } from "@adoa/core";
import type { PbiImportSource } from "../../models/PbiImportSource";
import type { PendingImport } from "../../models/PendingImport";

// Writers write "<name>.json.tmp" and rename it, so a file is never read half written.
const ITEM_FILE = /\.json$/i;
const FAILED_FOLDER = "failed";

// A source whose items are JSON files in one folder: imported files are deleted, unusable ones move to failed/ with a
// .reason.txt. Subclasses only say how a file's content becomes a request.
export abstract class FolderImportSource implements PbiImportSource {
  protected constructor(public readonly id: string, private readonly folder: string) {}

  protected abstract toRequest(content: unknown, file: string): Outcome<PbiImportRequest>;

  async readPending(limit: number): Promise<PendingImport[]> {
    const files = (await this.itemFiles(this.folder)).slice(0, limit);

    return Promise.all(files.map((file) => this.pendingImport(file)));
  }

  async status(): Promise<ImportSourceStatus> {
    const waiting = (await this.itemFiles(this.folder)).length;
    const failed = (await this.itemFiles(path.join(this.folder, FAILED_FOLDER))).length;

    return { source: this.id, waiting, failed };
  }

  private async pendingImport(file: string): Promise<PendingImport> {
    const filePath = path.join(this.folder, file);

    return {
      label: `${this.id}/${file}`,
      request: await this.readRequest(filePath, file),
      complete: () => rm(filePath, { force: true }),
      reject: (reason) => this.moveToFailed(file, reason),
    };
  }

  // Windows tools may write a BOM, which JSON.parse refuses.
  private async readRequest(filePath: string, file: string): Promise<Outcome<PbiImportRequest>> {
    try {
      const content = JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));

      return this.toRequest(content, file);
    } catch (error) {
      return { ok: false, error: `Not valid JSON: ${(error as Error).message}` };
    }
  }

  private async moveToFailed(file: string, reason: string): Promise<void> {
    const failed = path.join(this.folder, FAILED_FOLDER);

    await mkdir(failed, { recursive: true });
    await rename(path.join(this.folder, file), path.join(failed, file));
    await writeFile(path.join(failed, `${file}.reason.txt`), `${reason}\n`);
  }

  // Oldest first; a missing folder has no items.
  private async itemFiles(folder: string): Promise<string[]> {
    const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
    const names = entries.filter((entry) => entry.isFile() && ITEM_FILE.test(entry.name)).map((entry) => entry.name);
    const dated = await Promise.all(names.map(async (name) => ({ name, modified: (await stat(path.join(folder, name))).mtimeMs })));

    return dated.sort((a, b) => a.modified - b.modified).map((file) => file.name);
  }
}
