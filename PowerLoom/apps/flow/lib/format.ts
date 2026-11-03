export function formatTime(iso: string | null): string {
  if (!iso) return "–";

  return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "medium" });
}

/** The node's task title from its template: `{agent}`, `{kind}` and `{flow}` are filled in. */
export function fillTitle(template: string, values: { agent: string; kind: string; flow: string }): string {
  return template.replace(/\{(agent|kind|flow)\}/g, (_match, key: keyof typeof values) => values[key]);
}
