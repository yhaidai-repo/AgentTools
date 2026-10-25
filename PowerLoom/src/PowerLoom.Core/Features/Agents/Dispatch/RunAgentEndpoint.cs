using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Contracts;
using PowerLoom.Features.Agents.Dispatch.Models;
using PowerLoom.Infrastructure.AgentConfig;
using PowerLoom.Infrastructure.AgentConfig.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Agents.Dispatch;

// Agents page → Run now: the same dispatch the schedule does, right away. It says why nothing would start instead of
// answering "dispatched" for nothing (user request 2026-10-25): a disabled agent, agents paused, no open task of its types.
public static class RunAgentEndpoint
{
    [WolverinePost("/api/agents/{agentId}/run")]
    public static async Task<Results<Accepted<DispatchedAgent>, ProblemHttpResult>> Post(string agentId, [FromServices] AgentConfigReader agents, [FromServices] PowerLoomDbContext db, [FromServices] IMessageBus bus, CancellationToken cancellation)
    {
        var agent = await agents.ReadAsync(agentId, cancellation);

        if (agent is null)
            return Problem.NotFound($"Agent \"{agentId}\" is not configured.").ToProblemResult();

        var refusal = await RefusalAsync(agents, agent, cancellation);

        if (refusal is not null)
            return Problem.Conflict(refusal).ToProblemResult();

        var open = await OpenAgentTasks.ListAsync(db, agent.Id, agent.Handles, cancellation);

        if (open.Count > 0)
            await bus.PublishAsync(new DispatchAgent(agentId));

        return TypedResults.Accepted((string?)null, new DispatchedAgent(agentId, open.Count, MessageOf(agent, open.Count)));
    }

    private static async Task<string?> RefusalAsync(AgentConfigReader agents, AgentSummary agent, CancellationToken cancellation)
    {
        if (!agent.Enabled)
            return $"{agent.Label} is disabled: switch on Enabled on its Config page, then Run now.";

        var global = await agents.GlobalAsync(cancellation);

        if (!global.IsPaused(DateTimeOffset.UtcNow))
            return null;

        return global.PausedUntil is { } until && !global.Paused
            ? $"Agents are paused until {until:yyyy-MM-dd HH:mm} UTC (a rate limit): Run now works again then, or resume agents on the Agents page."
            : "Agents are paused: resume them on the Agents page, then Run now.";
    }

    private static string MessageOf(AgentSummary agent, int openTasks)
    {
        if (openTasks == 0)
            return $"Nothing to run: {agent.Label} has no open task of the types it takes ({string.Join(", ", agent.Handles)}).";

        return $"{agent.Label}: checking {openTasks} open task(s); valid ones start now, the others keep their reasons on their pages.";
    }
}
