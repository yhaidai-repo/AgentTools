// The schedule form's checkbox groups are named `param:<key>`; shared by the client form and the save action.
const PARAM_PREFIX = "param:";

export function paramFieldName(key: string): string {
  return `${PARAM_PREFIX}${key}`;
}

export function readParams(form: FormData): Record<string, string[]> {
  const keys = [...new Set([...form.keys()].filter((key) => key.startsWith(PARAM_PREFIX)))];

  return Object.fromEntries(keys.map((key) => [key.slice(PARAM_PREFIX.length), form.getAll(key).map(String)]));
}
