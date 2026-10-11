// The vaults root (bind-mounted at the same place in the worker, the agent-runner and the web), whose vault folders
// Settings → Vault review chooses from; null where it isn't mounted.
export function vaultsDir(): string | null {
  return process.env.VAULTS_DIR?.trim() || null;
}

// Vault folders never reviewed (PowerLoom's backlog vault, which only the renderer writes).
export function vaultsExclude(): string[] {
  return (process.env.VAULTS_EXCLUDE ?? "").split(",").map((folder) => folder.trim()).filter(Boolean);
}
