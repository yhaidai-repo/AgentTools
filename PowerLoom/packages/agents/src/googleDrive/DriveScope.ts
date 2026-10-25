import type { DriveFile } from "./models/DriveFile";
import type { GoogleDriveReader } from "./models/GoogleDriveReader";

// Guards against a folder tree that never ends (a shortcut loop, a huge drive): search covers this many folders.
const MAX_FOLDERS = 300;
const MAX_DEPTH = 30;

type Root = { id: string; name: string };

// The folders a vault lets agents read (user decision 2026-10-25: chosen folders only) and everything below them: the
// subfolders a search covers, and whether a file lies inside one (its parents walked up to a chosen folder).
export class DriveScope {
  private readonly trees = new Map<string, Promise<string[]>>();
  private readonly owners = new Map<string, Root | null>();

  constructor(private readonly reader: GoogleDriveReader, private readonly roots: Root[]) {}

  /** A chosen folder and its subfolders, at most MAX_FOLDERS. */
  foldersBelow(root: Root): Promise<string[]> {
    const known = this.trees.get(root.id) ?? this.walk(root.id);

    this.trees.set(root.id, known);

    return known;
  }

  /** The chosen folder a file lies in, or null when it lies outside them all. */
  async rootOf(file: DriveFile, depth = 0): Promise<Root | null> {
    const direct = this.roots.find((root) => root.id === file.id || file.parents.includes(root.id));

    if (direct || depth >= MAX_DEPTH || file.parents.length === 0) {
      return direct ?? null;
    }

    return this.firstRoot(file.parents, depth);
  }

  private async firstRoot(parents: string[], depth: number): Promise<Root | null> {
    for (const parent of parents) {
      const root = await this.parentRoot(parent, depth);

      if (root) {
        return root;
      }
    }

    return null;
  }

  private async parentRoot(id: string, depth: number): Promise<Root | null> {
    if (!this.owners.has(id)) {
      this.owners.set(id, await this.rootOf(await this.reader.get(id), depth + 1));
    }

    return this.owners.get(id) ?? null;
  }

  private async walk(rootId: string): Promise<string[]> {
    const found = [rootId];
    let level = [rootId];

    while (level.length > 0 && found.length < MAX_FOLDERS) {
      level = (await this.reader.childFolders(level)).map((folder) => folder.id).filter((id) => !found.includes(id));
      found.push(...level.slice(0, MAX_FOLDERS - found.length));
    }

    return found;
  }
}
