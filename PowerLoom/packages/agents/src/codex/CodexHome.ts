import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const AUTH_FILE = "auth.json";

// PowerLoom's own Codex home (PowerLoom/agent-homes/codex, mounted at CODEX_HOME), never the user's ~/.codex. Codex is
// signed in while its login file is there.
export class CodexHome {
  constructor(readonly path: string) {}

  get authFile(): string {
    return join(this.path, AUTH_FILE);
  }

  async isSignedIn(): Promise<boolean> {
    try {
      await access(this.authFile);

      return true;
    } catch {
      return false;
    }
  }

  async signOut(): Promise<void> {
    await rm(this.authFile, { force: true });
  }

  /** The fallback when the device flow fails: a login file from a PC where `codex login` worked. Throws when it isn't a JSON object. */
  async saveLoginFile(text: string): Promise<void> {
    if (!isJsonObject(text)) {
      throw new Error("That isn't a Codex login file: auth.json holds one JSON object.");
    }

    await mkdir(this.path, { recursive: true });
    await writeFile(this.authFile, text, { mode: 0o600 });
  }
}

function isJsonObject(text: string): boolean {
  try {
    const value: unknown = JSON.parse(text);

    return typeof value === "object" && value !== null && !Array.isArray(value);
  } catch {
    return false;
  }
}
