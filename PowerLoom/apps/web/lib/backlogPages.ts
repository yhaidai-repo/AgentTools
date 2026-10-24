import type { BacklogGroup } from "@/models/BacklogGroup";

// Pages count PBI groups (user request 2026-10-18): a PBI never leaves its child items on another page.
export const PAGE_SIZES = [25, 50, 100];

export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

export function pageSizeOf(value: string | undefined): number {
  const size = Number(value);

  return PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE;
}

export function pageCount(groups: BacklogGroup[], size: number): number {
  return Math.max(Math.ceil(groups.length / size), 1);
}

// The asked page, kept inside the pages there are; coming back from a PBI (`focus`), the page that holds it wins.
export function pageOf(groups: BacklogGroup[], size: number, asked: string | undefined, focus: number | null): number {
  const focused = focus === null ? -1 : groups.findIndex((group) => holds(group, focus));

  if (focused >= 0) {
    return Math.floor(focused / size) + 1;
  }

  return Math.min(Math.max(Number(asked) || 1, 1), pageCount(groups, size));
}

export function slicePage(groups: BacklogGroup[], size: number, page: number): BacklogGroup[] {
  return groups.slice((page - 1) * size, page * size);
}

export function holds(group: BacklogGroup, adoId: number): boolean {
  return group.parent.adoId === adoId || group.children.some((child) => child.adoId === adoId);
}
