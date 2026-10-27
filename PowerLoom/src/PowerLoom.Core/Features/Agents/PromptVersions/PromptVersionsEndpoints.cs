using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Features.Agents.PromptVersions.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using Wolverine.Http;

namespace PowerLoom.Features.Agents.PromptVersions;

// The prompt history the Config page shows and restores from (user decision 2026-10-23: every edit is a new version).
// The agent definitions stay the AgentConfig module's; their history is PowerLoom's table, written here only.
public static class PromptVersionsEndpoints
{
    [WolverinePost("/api/agents/{agentId}/prompt-versions")]
    public static async Task<Results<Ok, ProblemHttpResult>> Post(string agentId, AddPromptVersionRequest request, PowerLoomDbContext db, CancellationToken cancellation)
    {
        if (await db.AgentPromptVersions.AnyAsync(row => row.AgentId == agentId && row.Version == request.Version, cancellation))
            return Problem.Conflict($"{agentId} already has prompt version {request.Version}.").ToProblemResult();

        db.AgentPromptVersions.Add(new AgentPromptVersion { AgentId = agentId, Version = request.Version, Text = request.Text });
        await db.SaveChangesAsync(cancellation);

        return TypedResults.Ok();
    }

    // A deleted agent takes its prompt history with it.
    [WolverineDelete("/api/agents/{agentId}/prompt-versions")]
    public static async Task<Ok> Delete(string agentId, PowerLoomDbContext db, CancellationToken cancellation)
    {
        await db.AgentPromptVersions.Where(row => row.AgentId == agentId).ExecuteDeleteAsync(cancellation);

        return TypedResults.Ok();
    }
}
