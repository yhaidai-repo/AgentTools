// What the Backlog shows: the statuses picked (none = all), the page and how many PBI groups a page holds, and the PBI
// to scroll to when coming back from its page.
export interface BacklogView {
  statuses: string[];
  page: number;
  size: number;
  focus: number | null;
}
