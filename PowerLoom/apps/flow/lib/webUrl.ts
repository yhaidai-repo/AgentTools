// The web app's address for the header's external links (Tasks, Agents); 127.0.0.1 so the vault cookie is shared.
export function webUrl(): string {
  return (process.env.WEB_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
}
