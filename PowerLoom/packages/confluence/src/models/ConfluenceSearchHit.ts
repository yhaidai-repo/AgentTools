// One page a Confluence search found.
export interface ConfluenceSearchHit {
  id: string;
  title: string;
  /** The page's link, as a user would open it. */
  url: string;
  excerpt: string;
}
