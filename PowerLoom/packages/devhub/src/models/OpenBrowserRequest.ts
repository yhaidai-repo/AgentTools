// POST /browser: one recorded browser case served by its own Playwright MCP; the owner (a run) is the only one whose
// close DevHub accepts.
export interface OpenBrowserRequest {
  owner: string;
  case: string;
  headless?: boolean;
}
