import { describeCommands, findCommand, runCommand, type Outcome } from "@powerloom/core";
import { text } from "node:stream/consumers";
import { webCommandContext } from "../lib/commandContext";

// PowerLoom's commands on the command line (user decision 2026-10-09: no MCP yet), for Claude chats and skills:
//   docker exec -i powerloom-web-1 npm run -s cli -w @powerloom/web -- <command> ['<json input>']
// The input is the second argument or comes on stdin; the outcome is printed as JSON (exit code 1 on an error). Without
// a command it lists every command with its input schema.
const ACTOR = "cli";

const [name, inlineInput] = process.argv.slice(2);
const outcome = name ? await runNamed(name, inlineInput) : { ok: true as const, value: describeCommands() };

// The database pool keeps the process alive; exit once the output is written.
process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`, () => process.exit(outcome.ok ? 0 : 1));

async function runNamed(commandName: string, inline: string | undefined): Promise<Outcome<unknown>> {
  const command = findCommand(commandName);

  if (!command) {
    return { ok: false, error: `No command ${commandName}. Run without arguments to list them.` };
  }

  const input = parseInput(inline ?? (await readStdin()));

  if (!input.ok) {
    return input;
  }

  return runCommand(command, { ...webCommandContext(), actor: ACTOR }, input.value);
}

function parseInput(raw: string): Outcome<unknown> {
  try {
    return { ok: true, value: raw.trim() ? JSON.parse(raw) : {} };
  } catch (error) {
    return { ok: false, error: `The input isn't JSON: ${(error as Error).message}` };
  }
}

// Nothing piped in (an interactive terminal) means no input.
async function readStdin(): Promise<string> {
  return process.stdin.isTTY ? "" : text(process.stdin);
}
