// Filters that are one choice across pages: the period for Agents, Runs and Tasks (user decision 2026-10-02).
export const SHARED_FILTERS = ["range"];

// Remembered filters live in cookies, so the server renders a page with them at once (no unfiltered first paint).
export const COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function pageFilterCookie(pathname: string): string {
  return `adoa_filters${pathname.replace(/[^a-z0-9]+/gi, "_")}`;
}

export function sharedFilterCookie(name: string): string {
  return `adoa_shared_${name}`;
}
