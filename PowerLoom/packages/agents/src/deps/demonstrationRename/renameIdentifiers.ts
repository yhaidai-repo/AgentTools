import { IDENTIFIER_RENAMES, PROMPT_RENAMES } from "./legacyNames";

// A stored JSON value with every identifier the rename covers replaced, wherever it is a whole string or an object key.
// Free text (descriptions, summaries) never equals an identifier, so it is left alone.
export function renameIdentifiers<T>(value: T, names: ReadonlyMap<string, string> = IDENTIFIER_RENAMES): T {
  return rename(value, names) as T;
}

export function renameIdentifier(identifier: string): string {
  return IDENTIFIER_RENAMES.get(identifier) ?? identifier;
}

export function renamePromptText(text: string): string {
  return PROMPT_RENAMES.reduce((current, [legacy, renamed]) => current.replaceAll(legacy, renamed), text);
}

function rename(value: unknown, names: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") {
    return names.get(value) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map(inner => rename(inner, names));
  }

  if (value !== null && typeof value === "object") {
    const entries = new Map<string, unknown>();
    for (const [key, inner] of Object.entries(value)) {
      const renamedKey = names.get(key) ?? key;
      const renamedValue = rename(inner, names);
      if (entries.has(renamedKey) && JSON.stringify(entries.get(renamedKey)) !== JSON.stringify(renamedValue)) {
        throw new Error(`Cannot rename stored key ${key} to ${renamedKey}: conflicting values exist.`);
      }
      entries.set(renamedKey, renamedValue);
    }
    return Object.fromEntries(entries);
  }

  return value;
}
