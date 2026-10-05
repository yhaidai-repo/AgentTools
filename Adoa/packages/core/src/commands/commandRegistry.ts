import type { Command } from "../models/Command";
import { answerReviewCommentCommand } from "./answerReviewCommentCommand";
import { closeItemCommand } from "./closeItemCommand";
import { createWwwRecordCommand } from "./createWwwRecordCommand";
import { deletePbiCommand } from "./deletePbiCommand";
import { finishPbiCommand } from "./finishPbiCommand";
import { openChatCommand } from "./openChatCommand";
import { rerunTaskCommand } from "./rerunTaskCommand";
import { savePbiReposCommand } from "./savePbiReposCommand";
import { savePbiSkillsCommand } from "./savePbiSkillsCommand";

// Every command with a contract (user decision 2026-10-05): what an MCP server lists as tools. Web actions and later
// callers run them through runCommand, so each change happens in one place.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a list of commands with different input and output types
export const COMMANDS: readonly Command<any, any>[] = [
  finishPbiCommand,
  deletePbiCommand,
  savePbiReposCommand,
  savePbiSkillsCommand,
  closeItemCommand,
  rerunTaskCommand,
  answerReviewCommentCommand,
  createWwwRecordCommand,
  openChatCommand,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see COMMANDS
export function findCommand(name: string): Command<any, any> | null {
  return COMMANDS.find((command) => command.name === name) ?? null;
}
