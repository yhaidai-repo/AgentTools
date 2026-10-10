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

// adoa's templates for a new vault's root files (in the image).
export function vaultTemplateHome(): string {
  return requireEnv("VAULT_TEMPLATE_HOME");
}

// The vaults root on the PC, for the paths written into a new vault's files.
export function vaultsHostRoot(): string {
  return requireEnv("VAULTS_HOST_ROOT").replaceAll("\\", "/").replace(/\/+$/, "");
}

// adoa's backlog vault (bind-mounted): one folder per vault inside it.
export function backlogMount(): string {
  return requireEnv("BACKLOG_MOUNT");
}

// The folder the one backlog was rendered into before vaults became accounts; moved to the first vault's folder at start.
export function legacyBacklogFolder(): string {
  return process.env.LEGACY_BACKLOG_FOLDER?.trim() || "backlog";
}
