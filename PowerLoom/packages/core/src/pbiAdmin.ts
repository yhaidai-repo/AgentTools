// Its id (123, #123), a link to it in Azure DevOps (…/_workitems/edit/123, …/workitems/123, ?id=123) or in PowerLoom (/pbis/123).
const PBI_REFERENCES = [/^#?(\d+)$/, /workitems\/(?:edit\/)?(\d+)/i, /\/pbis\/(\d+)/, /[?&]id=(\d+)/];

// A PBI as the user types it.
export function parsePbiReference(text: string): number | null {
  const value = text.trim();
  const id = PBI_REFERENCES.map((pattern) => value.match(pattern)?.[1]).find(Boolean);

  return id ? Number(id) : null;
}
