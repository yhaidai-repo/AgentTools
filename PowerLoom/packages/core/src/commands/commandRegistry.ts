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
import { saveFrameworkCommand } from "./saveFrameworkCommand";
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
import { stopTaskCommand } from "./stopTaskCommand";
import { editTaskCommand } from "./editTaskCommand";
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
import { listFailureReportsCommand } from "./listFailureReportsCommand";
import { reportFailureCommand } from "./reportFailureCommand";
import { getRunCommand } from "./getRunCommand";
import { readLogsCommand } from "./readLogsCommand";
import { getRunEventsCommand } from "./getRunEventsCommand";
import { listAgentsCommand } from "./listAgentsCommand";
import { getAgentCommand } from "./getAgentCommand";
import { getAgentsGlobalCommand } from "./getAgentsGlobalCommand";
import { getFrameworkCommand } from "./getFrameworkCommand";
import { getUsageSummaryCommand } from "./getUsageSummaryCommand";
import { listDataAccessCommand } from "./listDataAccessCommand";
import { listDeadLettersCommand } from "./listDeadLettersCommand";
import { getStatusCommand } from "./getStatusCommand";
import { readPerformanceCommand, readTelemetryLogsCommand, listTelemetryTracesCommand, getTelemetryTraceCommand } from "./diagnosticsCommands";
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
import { attachToPbiCommand } from "./attachToPbiCommand";
import { addConfluenceLinkCommand } from "./addConfluenceLinkCommand";
import { removeConfluenceLinkCommand } from "./removeConfluenceLinkCommand";
import { loadConfluencePageCommand } from "./loadConfluencePageCommand";
import { createTaskCommand } from "./createTaskCommand";
import { saveScheduleCommand } from "./saveScheduleCommand";
import { deleteScheduleCommand } from "./deleteScheduleCommand";
import { tickScheduleCommand } from "./tickScheduleCommand";
import { deleteItemCommand } from "./deleteItemCommand";
import { saveTaskNotesCommand } from "./saveTaskNotesCommand";
import { addLocalReviewCommand } from "./addLocalReviewCommand";
import { addReviewCommand } from "./addReviewCommand";
import { queueReviewCommand } from "./queueReviewCommand";
import { closeReviewCommand } from "./closeReviewCommand";
import { syncPullRequestsCommand } from "./syncPullRequestsCommand";
import { enableRepoCommand } from "./enableRepoCommand";
import { addLocalRepoCommand } from "./addLocalRepoCommand";
import { removeRepoCommand } from "./removeRepoCommand";
import { saveRepoCommandsCommand } from "./saveRepoCommandsCommand";
import { saveSandboxSettingsCommand } from "./saveSandboxSettingsCommand";
import { savePackageFeedCommand } from "./savePackageFeedCommand";
import { removePackageFeedCommand } from "./removePackageFeedCommand";
import { addVaultCommand } from "./addVaultCommand";
import { removeVaultCommand } from "./removeVaultCommand";
import { restoreTrashCommand } from "./restoreTrashCommand";
import { deleteTrashCommand } from "./deleteTrashCommand";
import { runCleanupCommand } from "./runCleanupCommand";
import { replayDeadLetterCommand } from "./replayDeadLetterCommand";
import { discardDeadLetterCommand } from "./discardDeadLetterCommand";
import { getSettingsCommand } from "./getSettingsCommand";
import { captureDraftCommand } from "./captureDraftCommand";
import { addRegisterRecordCommand } from "./addRegisterRecordCommand";
import { closeRegisterRecordCommand } from "./closeRegisterRecordCommand";

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
  stopTaskCommand,
  editTaskCommand,
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
  saveFrameworkCommand,
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
  attachToPbiCommand,
  addConfluenceLinkCommand,
  removeConfluenceLinkCommand,
  loadConfluencePageCommand,
  createTaskCommand,
  saveScheduleCommand,
  deleteScheduleCommand,
  tickScheduleCommand,
  deleteItemCommand,
  saveTaskNotesCommand,
  addReviewCommand,
  addLocalReviewCommand,
  queueReviewCommand,
  closeReviewCommand,
  syncPullRequestsCommand,
  enableRepoCommand,
  addLocalRepoCommand,
  removeRepoCommand,
  saveRepoCommandsCommand,
  saveSandboxSettingsCommand,
  savePackageFeedCommand,
  removePackageFeedCommand,
  addVaultCommand,
  removeVaultCommand,
  restoreTrashCommand,
  deleteTrashCommand,
  runCleanupCommand,
  replayDeadLetterCommand,
  discardDeadLetterCommand,
  getSettingsCommand,
  captureDraftCommand,
  reportFailureCommand,
  addRegisterRecordCommand,
  closeRegisterRecordCommand,
  // The read commands (stage 2 of the powerloom-mcp design, 2026-10-23): what the pages show, for the chats.
  listPbisCommand,
  listTasksCommand,
  getTaskCommand,
  listTestCasesCommand,
  listSchedulesCommand,
  getScheduleCommand,
  listRunsCommand,
  getRunCommand,
  readLogsCommand,
  getRunEventsCommand,
  listAgentsCommand,
  getAgentCommand,
  getAgentsGlobalCommand,
  getFrameworkCommand,
  getUsageSummaryCommand,
  listDataAccessCommand,
  listFailureReportsCommand,
  listDeadLettersCommand,
  getStatusCommand,
  readPerformanceCommand,
  readTelemetryLogsCommand,
  listTelemetryTracesCommand,
  getTelemetryTraceCommand,
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
