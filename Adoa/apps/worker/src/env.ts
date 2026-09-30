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
