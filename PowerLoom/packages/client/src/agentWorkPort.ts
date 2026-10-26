import type { AgentWorkPort } from "@powerloom/core";
import type { PowerLoomClient } from "./createPowerLoomClient";
import { powerloomFailure } from "./powerloomFailure";

export function agentWorkPort(powerloom: PowerLoomClient): AgentWorkPort {
  return {
    async addPromptVersion(agentId, version, text) {
      const { error, response } = await powerloom.POST("/api/agents/{agentId}/prompt-versions", { params: { path: { agentId } }, body: { version, text } });

      return response.ok ? { ok: true, value: version } : powerloomFailure(error, response);
    },
    async deletePromptVersions(agentId) {
      const { error, response } = await powerloom.DELETE("/api/agents/{agentId}/prompt-versions", { params: { path: { agentId } } });

      return response.ok ? { ok: true, value: agentId } : powerloomFailure(error, response);
    },
  };
}
