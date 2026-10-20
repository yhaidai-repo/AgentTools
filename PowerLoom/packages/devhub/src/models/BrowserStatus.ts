// GET /browser: the open case, if any.
export interface BrowserStatus {
  open: boolean;
  owner: string | null;
  case: string | null;
  url: string | null;
  title: string | null;
  expiresAt: string | null;
}
