/** An item's PBI (null for a task without one), or undefined when there is no such item. */
export type ItemPbiLookup = (itemId: string) => Promise<number | null | undefined>;
