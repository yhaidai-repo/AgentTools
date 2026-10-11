// A query a person runs for an agent: it must run as written (no placeholders).
export interface HumanTaskQuery {
  language: "kql" | "cosmos-sql" | "sql";
  text: string;
}
