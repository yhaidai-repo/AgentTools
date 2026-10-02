// "Load from Confluence" on the PBI page: the worker (which holds the token) fetches this linked page now.
export interface ConfluenceFetchJob {
  adoId: number;
  url: string;
}
