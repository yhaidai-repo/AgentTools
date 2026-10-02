// A Confluence page as adoa reads it: its rendered body (HTML) and version.
export interface ConfluencePage {
  id: string;
  title: string;
  version: number;
  html: string;
}
