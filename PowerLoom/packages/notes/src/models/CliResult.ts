// The JSON the draft and register commands print.
export interface CliResult {
  ok: boolean;
  errors: string[];
  [field: string]: unknown;
}
