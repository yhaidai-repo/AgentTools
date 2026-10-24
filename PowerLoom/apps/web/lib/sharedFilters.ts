// Filters that are one choice across pages: the period for Dashboard, Agents, Tasks and Vault (user decision 2026-10-02),
// remembered per vault (user decision 2026-10-18).
export const SHARED_FILTERS = ["range"];

// Remembered filters live in cookies, so the server renders a page with them at once (no unfiltered first paint).
export const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

// The selected vault (user decision 2026-10-05): one choice for every page, like an account.
export const VAULT_COOKIE = "powerloom_vault";

export function pageFilterCookie(pathname: string): string {
  return `powerloom_filters${pathname.replace(/[^a-z0-9]+/gi, "_")}`;
}

export function sharedFilterCookie(name: string, vault: string): string {
  return `powerloom_shared_${name}_${vault.replace(/[^a-z0-9]+/gi, "_")}`;
}
