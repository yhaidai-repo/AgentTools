using System.Text.Json;

namespace PowerLoom.Infrastructure.AgentConfig.Models;

// The part of an agent's definition (the AgentConfig module's `agent_config.agent` row) the host reads: whether it
// runs, who follows it, and the options its code reads (e.g. the vault review's staleDays).
public sealed record AgentSummary(string Id, string Label, bool Enabled, string? Next, JsonElement Options);
