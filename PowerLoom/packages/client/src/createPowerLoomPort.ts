import type { ChatTarget, CloseItemRequest, CreatePbiInput, ItemStatus, Outcome, PbiFeedback, PbiSkillChoices, PowerLoomPort, ReportBugInput } from "@powerloom/core";
import type { PowerLoomClient } from "./createPowerLoomClient";
import { powerloomFailure, problemDetail } from "./powerloomFailure";

// The commands' way to PowerLoom over its API: one adapter for every caller (the web, the CLI, the MCP server).
export function createPowerLoomPort(powerloom: PowerLoomClient): PowerLoomPort {
  return {
    // PowerLoom answers 202 when the record is queued; anything else is an unexpected failure of the change.
    async addRecord(kind, sourceId) {
      const { response, error } = await powerloom.POST("/api/records", { body: { kind, sourceId } });

      if (!response.ok) {
        throw new Error(`PowerLoom didn't take the ${kind} record ${sourceId}: ${problemDetail(error, response)}`);
      }
    },
    async openChat(target) {
      const { data, error, response } = await powerloom.POST("/api/chats", { body: chatRequest(target) });

      return data ? { ok: true, value: { url: data.url } } : powerloomFailure(error, response);
    },
    async deletePbi(adoId) {
      const { data, error, response } = await powerloom.DELETE("/api/pbis", { body: { adoIds: [adoId] } });

      if (!data) {
        return powerloomFailure(error, response);
      }

      return data.refused.length === 0 ? { ok: true, value: data.deleted[0]?.title ?? "" } : { ok: false, error: data.refused[0] };
    },
    async closePbi(adoId, actor) {
      const { data, error, response } = await powerloom.POST("/api/pbis/close", { body: { adoIds: [adoId], actor } });

      return data ? oneChanged(data) : powerloomFailure(error, response);
    },
    async reopenPbi(adoId, actor) {
      const { data, error, response } = await powerloom.POST("/api/pbis/reopen", { body: { adoIds: [adoId], actor } });

      return data ? oneChanged(data) : powerloomFailure(error, response);
    },
    async closeItem(request: CloseItemRequest, dryRun = false) {
      const { data, error, response } = await powerloom.POST("/api/items/{id}/close", {
        params: { path: { id: request.itemId } },
        body: { adoId: request.adoId, decision: request.decision, resolution: request.resolution, hasAttachment: request.hasAttachment, dryRun },
      });

      return data ? { ok: true, value: { status: data.status as ItemStatus } } : powerloomFailure(error, response);
    },
    async rerunTask(adoId, itemId, startOver) {
      const { data, error, response } = await powerloom.POST("/api/tasks/rerun", { body: { tasks: [{ adoId, itemId, startOver }] } });

      if (!data) {
        return powerloomFailure(error, response);
      }

      return data.reopened.length === 1 ? { ok: true, value: data.reopened[0] } : { ok: false, error: data.refused[0] ?? "Not reopened." };
    },
    async deleteItem(adoId, itemId) {
      const { data, error, response } = await powerloom.DELETE("/api/items/{id}", { params: { path: { id: itemId } }, body: { adoId } });

      return data ? { ok: true, value: data.itemId } : powerloomFailure(error, response);
    },
    async reportBug(input: ReportBugInput, actor: string) {
      const { data, error, response } = await powerloom.POST("/api/bugs", { body: { parent: input.parent, title: input.title, descriptionMd: input.descriptionMd, priority: input.priority, actor } });

      return data ? { ok: true, value: data } : powerloomFailure(error, response);
    },
    async answerReviewComment(commentId, answer) {
      const { data, error, response } = await powerloom.POST("/api/review-comments/{id}/answer", { params: { path: { id: commentId } }, body: { answer } });

      return data ? { ok: true, value: data } : powerloomFailure(error, response);
    },
    async deleteReview(prId) {
      const { data, error, response } = await powerloom.DELETE("/api/reviews", { body: { prIds: [prId] } });

      if (!data) {
        return powerloomFailure(error, response);
      }

      return data.refused.length === 0 ? { ok: true, value: data.done[0]?.value ?? "" } : { ok: false, error: data.refused[0] };
    },
    async createPbi(input: CreatePbiInput, actor: string) {
      const { data, error, response } = await powerloom.POST("/api/pbis", { body: { vault: input.vault ?? null, title: input.title, type: input.type, priority: input.priority, descriptionMd: input.descriptionMd, acceptanceCriteriaMd: input.acceptanceCriteriaMd, parentId: input.parentId, actor } });

      return data ? { ok: true, value: { adoId: data.adoId } } : powerloomFailure(error, response);
    },
    async finishPbi(feedback: PbiFeedback, actor: string) {
      const { data, error, response } = await powerloom.POST("/api/pbis/{adoId}/finish", { params: { path: { adoId: feedback.adoId } }, body: { rating: feedback.rating, effortHours: feedback.effortHours, whatWentWrong: feedback.whatWentWrong, fault: feedback.fault, actor } });

      return data ? { ok: true, value: { message: data.message, wwwRecordId: data.wwwRecordId } } : powerloomFailure(error, response);
    },
    async savePbiRepos(adoId, repos) {
      const { data, error, response } = await powerloom.PUT("/api/pbis/{adoId}/repos", { params: { path: { adoId } }, body: { repos } });

      return data ? { ok: true, value: data.saved } : powerloomFailure(error, response);
    },
    async savePbiSkills(choices: PbiSkillChoices) {
      const { data, error, response } = await powerloom.PUT("/api/pbis/{adoId}/skills", { params: { path: { adoId: choices.adoId } }, body: { skills: choices.skills } });

      return data ? { ok: true, value: data.saved } : powerloomFailure(error, response);
    },
    async createSkill(name, content) {
      const { data, error, response } = await powerloom.POST("/api/skills", { body: { name, content } });

      return data ? { ok: true, value: data.name } : powerloomFailure(error, response);
    },
  };
}

// Close and reopen answer per PBI; for one PBI, its line is the outcome.
function oneChanged(data: { done: string[]; refused: string[] }): Outcome<string> {
  return data.refused.length === 0 ? { ok: true, value: data.done[0] ?? "" } : { ok: false, error: data.refused[0] };
}

function chatRequest(target: ChatTarget): { kind: "pbi" | "item" | "review" | "vault"; id: string } {
  switch (target.kind) {
    case "pbi":
      return { kind: "pbi", id: String(target.adoId) };
    case "item":
      return { kind: "item", id: target.itemId };
    case "review":
      return { kind: "review", id: String(target.prId) };
    case "vault":
      return { kind: "vault", id: target.vault };
  }
}
