// A page's address with its choices as URL parameters; empty ones are left out.
export function pageUrl(path: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();

  for (const [name, value] of Object.entries(params)) {
    addIfAny(query, name, value);
  }

  return `${path}?${query.toString()}`;
}

function addIfAny(query: URLSearchParams, name: string, value: string | number | undefined): void {
  if (value !== undefined && value !== "") {
    query.set(name, String(value));
  }
}
