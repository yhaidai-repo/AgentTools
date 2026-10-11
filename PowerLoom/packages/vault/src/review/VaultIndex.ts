import type { ScannedNote } from "../models/ScannedNote";
import type { VaultUsageEvent } from "../models/VaultUsageEvent";
import type { WikiLink } from "../models/WikiLink";
import { isUse } from "./usageLog";
import { linkKey, parseWikiLinks } from "./wikiLinks";

// One vault's notes, their links resolved the way Obsidian does (by file name anywhere in the vault, or by path), and
// each note's last use from VaultUsage's log.
export class VaultIndex {
  private readonly byName = new Map<string, string[]>();
  private readonly byPath = new Map<string, string>();
  private readonly links: WikiLink[];
  private readonly inbound = new Map<string, WikiLink[]>();
  private readonly lastUses = new Map<string, Date>();

  constructor(
    readonly vault: string,
    readonly notes: ScannedNote[],
    /** Every other (non-Markdown) file, e.g. attachments, which links may point to as well. */
    private readonly otherFiles: string[],
    readonly usage: VaultUsageEvent[],
  ) {
    [...notes.map((note) => note.path), ...otherFiles].sort().forEach((path) => this.addFile(path));
    this.links = notes.flatMap((note) => parseWikiLinks(note.path, note.content));
    this.links.forEach((link) => this.addInbound(link));
    usage.filter(isUse).forEach((event) => this.addUse(event));
  }

  note(path: string): ScannedNote | undefined {
    return this.notes.find((note) => note.path === path);
  }

  linksFrom(path: string): WikiLink[] {
    return this.links.filter((link) => link.from === path);
  }

  /** Links from other notes to this one. */
  linksTo(path: string): WikiLink[] {
    return this.inbound.get(path) ?? [];
  }

  /** The file a link target points to; null for a dead link. */
  resolve(target: string): string | null {
    const key = linkKey(target);

    if (!key.includes("/")) {
      return this.byName.get(key)?.[0] ?? null;
    }

    const exact = this.byPath.get(key);

    return exact ?? [...this.byPath].find(([path]) => path.endsWith(`/${key}`))?.[1] ?? null;
  }

  /** Links whose target is no file of the vault. */
  deadLinks(): WikiLink[] {
    return this.links.filter((link) => this.resolve(link.target) === null);
  }

  lastUse(path: string): Date | null {
    return this.lastUses.get(path) ?? null;
  }

  /** The log's first event: "never used" means something only once the log is old enough. */
  logStartedAt(): Date | null {
    return this.usage.reduce<Date | null>((first, event) => (first && first < event.at ? first : event.at), null);
  }

  /** The vault as it will be after a run's edits and removals (same mtimes and usage). */
  withChanges(edits: Map<string, string>, removed: string[]): VaultIndex {
    const kept = this.notes.filter((note) => !removed.includes(note.path));
    const notes = kept.map((note) => (edits.has(note.path) ? { ...note, content: edits.get(note.path)! } : note));

    return new VaultIndex(this.vault, notes, this.otherFiles.filter((path) => !removed.includes(path)), this.usage);
  }

  private addFile(path: string): void {
    const key = linkKey(path);
    const name = key.split("/").pop()!;

    this.byPath.set(key, path);
    this.byName.set(name, [...(this.byName.get(name) ?? []), path]);
  }

  private addInbound(link: WikiLink): void {
    const target = this.resolve(link.target);

    if (target === null || target === link.from) {
      return;
    }

    this.inbound.set(target, [...(this.inbound.get(target) ?? []), link]);
  }

  private addUse(event: VaultUsageEvent): void {
    const latest = this.lastUses.get(event.file);

    if (!latest || latest < event.at) {
      this.lastUses.set(event.file, event.at);
    }
  }
}
