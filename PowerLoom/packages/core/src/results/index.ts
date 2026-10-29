// The results domain: the reads the web pages and the read commands share (stage 2 of the powerloom-mcp design, 2026-10-23).
export { loadResult, resultOwner } from "./resultContent";
export { PBI_RESULT_KIND_NAMES, RESULT_KIND_NAMES, chosenVersion, pbiResultKindOf, resultKindOf, versionKey } from "./resultLinks";
export { latestPbiVersion, loadPbiResultSets, loadReviewResultSet, loadSiblingVersions, loadTaskResultSets } from "./resultVersions";
export { resultVault, vaultOfPr, vaultOfTask } from "./resultVault";
export { toResultSetSummaries } from "./resultReads";
export type { AgentResult } from "../models/AgentResult";
export type { PbiResultKind } from "../models/PbiResultKind";
export type { ResultKind } from "../models/ResultKind";
export type { ResultOwner } from "../models/ResultOwner";
export type { ResultQuestion } from "../models/ResultQuestion";
export type { ResultRead } from "../models/ResultRead";
export type { ResultSet } from "../models/ResultSet";
export type { ResultSetSummary } from "../models/ResultSetSummary";
export type { ResultVersion } from "../models/ResultVersion";
export type { ResultVersionSummary } from "../models/ResultVersionSummary";
export type { ReviewRunResult } from "../models/ReviewRunResult";
