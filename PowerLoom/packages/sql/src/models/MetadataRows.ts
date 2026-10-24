/** Runs one of the reader's own catalogue queries (sys.objects, sys.columns) on the failed query's database; rows in array form. */
export type MetadataRows = (text: string, params: Record<string, string>) => Promise<unknown[][]>;
