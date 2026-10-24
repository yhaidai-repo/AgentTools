import { posix } from "node:path";

// The backend's limit on one attachment (AttachmentLimits.MaxBytes): a bigger file is refused before it is read.
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

// The repos folder holds more than code: a secrets repo, .env files, keys, sign-ins. A chat attaches the user's
// documents, never these; a file the user really wants attached from there goes through the PBI page.
const SECRET_FOLDERS = new Set(["dev-secrets", "devsecrets", ".git", ".ssh", ".aws", ".azure", ".gnupg", ".codex", ".claude"]);
const SECRET_FILES = new Set(["auth.json", ".npmrc", ".pgpass", ".netrc", "secrets.json", "credentials", "credentials.json"]);
const SECRET_EXTENSIONS = new Set([".pem", ".key", ".pfx", ".p12", ".jks", ".kdbx"]);
const SAMPLE_ENV = /^\.env\.(example|sample|template)$/i;

/** Why a file can't be attached from a chat, or null when it can. */
export function secretFileProblem(path: string): string | null {
  const parts = path.replace(/\\/g, "/").split("/").map((part) => part.toLowerCase());
  const name = parts[parts.length - 1] ?? "";
  const folder = parts.slice(0, -1).find((part) => SECRET_FOLDERS.has(part));

  if (folder) {
    return `${path} is in a ${folder} folder, which holds secrets: a chat doesn't attach from there.`;
  }

  return isSecretName(name) ? `${path} looks like a secret (keys, tokens, sign-ins): a chat doesn't attach it.` : null;
}

function isSecretName(name: string): boolean {
  const isEnv = (name === ".env" || name.startsWith(".env.")) && !SAMPLE_ENV.test(name);

  return isEnv || SECRET_FILES.has(name) || SECRET_EXTENSIONS.has(posix.extname(name)) || name.startsWith("id_rsa") || name.startsWith("id_ed25519");
}
