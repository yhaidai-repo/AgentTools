// The notes a tech-writer run wrote, from the run's outputs: its note paths, relative to the task's vault. The
// outputs also list a removed draft ("… removed") and finding ids; an actualize or request run prefixes its paths
// with the vault's name.
export function writtenNotes(outputs: unknown, vault: string): string[] {
  const entries = Array.isArray(outputs) ? outputs.filter((entry): entry is string => typeof entry === "string") : [];
  const prefix = `${vault}/`;

  return entries.filter((entry) => entry.endsWith(".md")).map((entry) => (entry.startsWith(prefix) ? entry.slice(prefix.length) : entry));
}
