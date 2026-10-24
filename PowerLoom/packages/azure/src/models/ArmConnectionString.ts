// One entry of Azure Resource Manager's listConnectionStrings answer for a Cosmos DB account.
export interface ArmConnectionString {
  connectionString: string;
  description?: string;
  /** Primary, Secondary, PrimaryReadonly, SecondaryReadonly. */
  keyKind?: string;
  /** Sql, MongoDB, … */
  type?: string;
}
