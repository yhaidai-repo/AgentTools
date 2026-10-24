import type { Command } from "../models/Command";
import { answerReviewCommentCommand } from "./answerReviewCommentCommand";
import { closeItemCommand } from "./closeItemCommand";
import { closePbiCommand } from "./closePbiCommand";
import { createAgentCommand } from "./createAgentCommand";
import { updateAgentCommand } from "./updateAgentCommand";
import { deleteAgentCommand } from "./deleteAgentCommand";
import { pauseAgentsCommand } from "./pauseAgentsCommand";
import { runAgentCommand } from "./runAgentCommand";
import { saveAgentsGlobalCommand } from "./saveAgentsGlobalCommand";
import { saveSkillCommand } from "./saveSkillCommand";
import { restoreSkillCommand } from "./restoreSkillCommand";
import { createSkillCommand } from "./createSkillCommand";
import { createWwwRecordCommand } from "./createWwwRecordCommand";
import { createPbiCommand } from "./createPbiCommand";
import { deletePbiCommand } from "./deletePbiCommand";
import { deleteReviewCommand } from "./deleteReviewCommand";
import { finishPbiCommand } from "./finishPbiCommand";
import { getPbiCommand } from "./getPbiCommand";
import { readPbiCommand } from "./readPbiCommand";
import { openChatCommand } from "./openChatCommand";
import { reopenPbiCommand } from "./reopenPbiCommand";
import { reportBugCommand } from "./reportBugCommand";
import { rerunTaskCommand } from "./rerunTaskCommand";
import { savePbiReposCommand } from "./savePbiReposCommand";
import { savePbiSkillsCommand } from "./savePbiSkillsCommand";
import { sqlDatabasesCommand } from "./sqlDatabasesCommand";
import { sqlDescribeCommand } from "./sqlDescribeCommand";
import { sqlQueryCommand } from "./sqlQueryCommand";
import { submitFindingCommand } from "./submitFindingCommand";
import { listPbisCommand } from "./listPbisCommand";
import { listTasksCommand } from "./listTasksCommand";
import { getTaskCommand } from "./getTaskCommand";
import { listTestCasesCommand } from "./listTestCasesCommand";
import { listSchedulesCommand } from "./listSchedulesCommand";
import { getScheduleCommand } from "./getScheduleCommand";
import { listRunsCommand } from "./listRunsCommand";
import { getRunCommand } from "./getRunCommand";
import { getRunEventsCommand } from "./getRunEventsCommand";
import { listAgentsCommand } from "./listAgentsCommand";
import { getAgentCommand } from "./getAgentCommand";
import { getAgentsGlobalCommand } from "./getAgentsGlobalCommand";
import { getUsageSummaryCommand } from "./getUsageSummaryCommand";
import { listDataAccessCommand } from "./listDataAccessCommand";
import { listDeadLettersCommand } from "./listDeadLettersCommand";
import { getStatusCommand } from "./getStatusCommand";
import { getResultCommand } from "./getResultCommand";
import { listResultVersionsCommand } from "./listResultVersionsCommand";
import { listReviewsCommand } from "./listReviewsCommand";
import { getReviewCommand } from "./getReviewCommand";
import { listVaultNotesCommand } from "./listVaultNotesCommand";
import { getVaultUsageCommand } from "./getVaultUsageCommand";
import { getVaultRegistersCommand } from "./getVaultRegistersCommand";
import { listVaultTrashCommand } from "./listVaultTrashCommand";
import { listSkillsCommand } from "./listSkillsCommand";
import { getSkillCommand } from "./getSkillCommand";
import { preparePbisCommand } from "./preparePbisCommand";
import { syncPbisCommand } from "./syncPbisCommand";
import { importNowCommand } from "./importNowCommand";
import { getPbiUserNotesCommand } from "./getPbiUserNotesCommand";
import { savePbiUserNotesCommand } from "./savePbiUserNotesCommand";

// Every command with a contract (user decision 2026-10-05): what an MCP server lists as tools. Web actions and later
// callers run them through runCommand, so each change happens in one place.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a list of commands with different input and output types
export const COMMANDS: readonly Command<any, any>[] = [
  finishPbiCommand,
  deletePbiCommand,
  closePbiCommand,
  reopenPbiCommand,
  createPbiCommand,
  getPbiCommand,
  readPbiCommand,
  reportBugCommand,
  deleteReviewCommand,
  savePbiReposCommand,
  savePbiSkillsCommand,
  closeItemCommand,
  submitFindingCommand,
  rerunTaskCommand,
  answerReviewCommentCommand,
  createWwwRecordCommand,
  openChatCommand,
  createSkillCommand,
  createAgentCommand,
  updateAgentCommand,
  deleteAgentCommand,
  pauseAgentsCommand,
  runAgentCommand,
  saveAgentsGlobalCommand,
  saveSkillCommand,
  restoreSkillCommand,
  sqlQueryCommand,
  sqlDescribeCommand,
  sqlDatabasesCommand,
  preparePbisCommand,
  syncPbisCommand,
  importNowCommand,
  getPbiUserNotesCommand,
  savePbiUserNotesCommand,
  // The read commands (stage 2 of the powerloom-mcp design, 2026-10-23): what the pages show, for the chats.
  listPbisCommand,
  listTasksCommand,
  getTaskCommand,
  listTestCasesCommand,
  listSchedulesCommand,
  getScheduleCommand,
  listRunsCommand,
  getRunCommand,
  getRunEventsCommand,
  listAgentsCommand,
  getAgentCommand,
  getAgentsGlobalCommand,
  getUsageSummaryCommand,
  listDataAccessCommand,
  listDeadLettersCommand,
  getStatusCommand,
  getResultCommand,
  listResultVersionsCommand,
  listReviewsCommand,
  getReviewCommand,
  listVaultNotesCommand,
  getVaultUsageCommand,
  getVaultRegistersCommand,
  listVaultTrashCommand,
  listSkillsCommand,
  getSkillCommand,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see COMMANDS
export function findCommand(name: string): Command<any, any> | null {
  return COMMANDS.find((command) => command.name === name) ?? null;
}
