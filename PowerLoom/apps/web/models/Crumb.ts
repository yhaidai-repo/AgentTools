// One step of a page's breadcrumbs. Every crumb but the page you are on links back; a list's link carries `focus` so
// the list finds the item you came from.
export interface Crumb {
  label: string;
  href?: string;
}
