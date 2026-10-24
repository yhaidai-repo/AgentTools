export interface DesignTest {
  kind: "unit" | "integration" | "manual";
  /** One line, given / when / then. */
  case: string;
}
