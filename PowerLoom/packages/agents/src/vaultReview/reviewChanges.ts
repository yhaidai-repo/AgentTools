import { linkKey, replaceWikiLinks, withFrontmatterField, type VaultIndex, type WikiLink } from "@powerloom/vault";
import type { VaultChanges } from "./models/VaultChanges";
import type { VaultReviewDraft } from "./models/VaultReviewDraft";
import { closeRecords } from "./recordChanges";

// The vault after the run's staged actions: link fixes applied, actualized notes marked for review (the vault rules'
// "can't re-verify → needs-review"), closed register records written, removed notes gone.
export function plannedChanges(index: VaultIndex, draft: VaultReviewDraft, today = new Date().toISOString().slice(0, 10)): VaultChanges {
  const edits = new Map<string, string>();
  const contentOf = (path: string) => edits.get(path) ?? index.note(path)?.content ?? "";

  draft.linkFixes.filter((fix) => fix.vault === index.vault).forEach((fix) => edits.set(fix.path, replaceWikiLinks(contentOf(fix.path), fix.target, fix.to)));

  const ofVault = draft.decisions.filter((decision) => decision.vault === index.vault);

  ofVault.filter((decision) => decision.action === "actualize").forEach((decision) => edits.set(decision.path, withFrontmatterField(contentOf(decision.path), "status", "needs-review")));
  closeRecords(index, draft.records, edits, contentOf, today);

  const removed = ofVault.filter((decision) => decision.action === "remove").map((decision) => decision.path);

  removed.forEach((path) => edits.delete(path));

  return { edits, removed };
}

// Links that would point at a removed note once the changes are applied (Obsidian turns a click on one into an empty
// note in the vault root, seen 2026-10-02).
export function linksLeftToRemoved(index: VaultIndex, changes: VaultChanges): WikiLink[] {
  const removedKeys = new Set(changes.removed.flatMap((path) => [linkKey(path), linkKey(path.split("/").pop()!)]));

  return index.withChanges(changes.edits, changes.removed).deadLinks().filter((link) => removedKeys.has(linkKey(link.target)));
}
