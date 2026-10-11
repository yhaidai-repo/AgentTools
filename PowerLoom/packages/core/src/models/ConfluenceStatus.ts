// What the worker reported at startup about its Confluence access (the token stays in the worker): the account, or null
// when CONFLUENCE_EMAIL / CONFLUENCE_API_TOKEN aren't both set.
export interface ConfluenceStatus {
  email: string | null;
}
