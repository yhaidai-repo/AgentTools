using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Contracts;
using PowerLoom.Features.Agents.Dispatch.Models;
using PowerLoom.Infrastructure.AgentConfig;
using PowerLoom.Infrastructure.Http;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Agents.Dispatch;

// Agents page → Run now: the same dispatch the schedule does, right away (a disabled or paused agent is skipped there).
public static class RunAgentEndpoint
{
    [WolverinePost("/api/agents/{agentId}/run")]
    public static async Task<Results<Accepted<DispatchedAgent>, ProblemHttpResult>> Post(string agentId, [FromServices] AgentConfigReader agents, [FromServices] IMessageBus bus, CancellationToken cancellation)
    {
        if (await agents.ReadAsync(agentId, cancellation) is null)
            return Problem.NotFound($"Agent \"{agentId}\" is not configured.").ToProblemResult();

        await bus.PublishAsync(new DispatchAgent(agentId));

        return TypedResults.Accepted((string?)null, new DispatchedAgent(agentId));
    }
}
