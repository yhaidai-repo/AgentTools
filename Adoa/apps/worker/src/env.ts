export function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

// Every vault's folder (bind-mounted writable): WWW records go to a vault's www-log.md.
export function vaultsRoot(): string {
  return requireEnv("VAULTS_DIR");
}

export function vaultRoot(): string {
  return process.env.VAULT_ROOT || requireEnv("VAULT_PATH");
}

// The import inbox folder (bind-mounted), where the import sources' files arrive; null when not set, so the pbi-import
// job only reports it.
export function importInboxRoot(): string | null {
  return process.env.IMPORT_INBOX_ROOT?.trim() || null;
}
