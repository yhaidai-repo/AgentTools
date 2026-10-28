import type { ContainerExec } from "../docker/ContainerExec";
import type { FileStore } from "../models/FileStore";

// Files the patch and edit tools read and write, as the sandbox user inside the container: they can't reach anything a
// command couldn't.
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FILE_DEADLINE_MS = 60_000;
const MISSING = 3;
const TOO_LARGE = 4;

const READ_SCRIPT = `[ -f "$1" ] || exit ${MISSING}; [ "$(stat -c %s -- "$1")" -le ${MAX_FILE_BYTES} ] || exit ${TOO_LARGE}; cat -- "$1"`;
const WRITE_SCRIPT = `mkdir -p -- "$(dirname -- "$1")" && cat > "$1"`;
const REMOVE_SCRIPT = `rm -f -- "$1"`;

export class ContainerFileStore implements FileStore {
  constructor(private readonly exec: ContainerExec) {}

  async read(path: string): Promise<string | null> {
    const result = await this.exec.run(["sh", "-c", READ_SCRIPT, "sh", path], { deadlineMs: FILE_DEADLINE_MS });

    if (result.exitCode === MISSING) {
      return null;
    }

    if (result.exitCode === TOO_LARGE) {
      throw new Error(`${path} is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB: change it with a command`);
    }

    return succeeded(result.exitCode, result.stderr, `read ${path}`) ? result.stdout.toString("utf8") : null;
  }

  async write(path: string, content: string): Promise<void> {
    const result = await this.exec.run(["sh", "-c", WRITE_SCRIPT, "sh", path], { stdin: Buffer.from(content, "utf8"), deadlineMs: FILE_DEADLINE_MS });

    succeeded(result.exitCode, result.stderr, `write ${path}`);
  }

  async remove(path: string): Promise<void> {
    const result = await this.exec.run(["sh", "-c", REMOVE_SCRIPT, "sh", path], { deadlineMs: FILE_DEADLINE_MS });

    succeeded(result.exitCode, result.stderr, `remove ${path}`);
  }
}

function succeeded(exitCode: number, stderr: string, what: string): true {
  if (exitCode !== 0) {
    throw new Error(`Could not ${what}: ${stderr.trim() || `exit code ${exitCode}`}`);
  }

  return true;
}
