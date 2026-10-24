/** One error SQL Server sent for a query: a batch can carry several (one per wrong name), and the driver keeps them all. */
export interface SqlServerError {
  number: number;
  message: string;
}
