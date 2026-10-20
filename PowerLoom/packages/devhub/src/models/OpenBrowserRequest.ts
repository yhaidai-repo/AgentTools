// POST /browser: one recorded browser case; the owner (a run) is the only one whose close DevHub accepts.
export interface OpenBrowserRequest {
  owner: string;
  case: string;
  url?: string;
  headless?: boolean;
}
