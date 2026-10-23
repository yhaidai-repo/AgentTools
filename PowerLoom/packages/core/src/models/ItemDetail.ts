import type { loadItemDetail } from "../tasks/itemDetail";

// One item as its page and task.get show it: the item with its body and data, its uploads, its findings and its runs.
export type ItemDetail = NonNullable<Awaited<ReturnType<typeof loadItemDetail>>>;
