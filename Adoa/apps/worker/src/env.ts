export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

export function vaultRoot(): string {
  return process.env.VAULT_ROOT || requireEnv("VAULT_PATH");
}

// The import inbox folder (bind-mounted), where the import sources' files arrive; null when not set, so the pbi-import
// job only reports it.
export function importInboxRoot(): string | null {
  return process.env.IMPORT_INBOX_ROOT?.trim() || null;
}
