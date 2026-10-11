// A command as a caller lists it: name, description and input JSON Schema.
export interface CommandInfo {
  name: string;
  description: string;
  input: Record<string, unknown>;
}
