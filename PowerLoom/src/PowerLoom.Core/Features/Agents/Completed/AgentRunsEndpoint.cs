using Microsoft.AspNetCore.Http.HttpResults;
using PowerLoom.Features.Agents.AgentRun;
using PowerLoom.Features.Agents.Completed.Models;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Agents.Completed;

// The runner's one callback, inside the compose network: the saga takes it from here.
public static class AgentRunsEndpoint
{
    [WolverinePost("/api/agent-runs/{taskId}/completed")]
    public static async Task<Accepted> Post(string taskId, CompletedRunRequest request, IMessageBus bus)
    {
        await bus.PublishAsync(new AgentRunCompleted(taskId, request.RunId, request.Outcome, request.Error));

        return TypedResults.Accepted((string?)null);
    }
}
