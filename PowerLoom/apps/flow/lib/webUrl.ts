// The web app's address for the links into it (header, task, run, agent and PBI pages); 127.0.0.1 so the vault cookie is
// shared. Server-side only: the pages put the finished URLs into what they send to the browser.
export function webUrl(): string {
  return (process.env.WEB_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
}

// A task's page: under its PBI, or on the Tasks page for items without one (web's itemPath; /tasks/<id> redirects to
// the PBI page when the item has one).
export function taskUrl(itemId: string, pbiId: number | null): string {
  return pbiId === null ? `${webUrl()}/tasks/${encodeURIComponent(itemId)}` : `${webUrl()}/pbis/${pbiId}/items/${encodeURIComponent(itemId)}`;
}

export function runUrl(runId: number): string {
  return `${webUrl()}/agents/runs/${runId}`;
}

export function agentUrl(agentId: string): string {
  return `${webUrl()}/agents/${encodeURIComponent(agentId)}`;
}

export function pbiUrl(adoId: number): string {
  return `${webUrl()}/pbis/${adoId}`;
}
