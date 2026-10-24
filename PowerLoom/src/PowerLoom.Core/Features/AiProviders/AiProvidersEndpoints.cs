using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Features.AiProviders.Models;
using PowerLoom.Infrastructure.Http;
using Wolverine.Http;

namespace PowerLoom.Features.AiProviders;

// Settings → AI providers: one section for the whole PowerLoom, not per vault. Each provider says whether agents can run
// on it; the Agents page offers only connected providers' models.
public static class AiProvidersEndpoints
{
    [WolverineGet("/api/ai-providers")]
    public static async Task<IReadOnlyList<ProviderStatus>> List(ClaudeConnection claude, CancellationToken cancellation) => [await claude.StatusAsync(cancellation)];

    [WolverinePut("/api/ai-providers/claude/token")]
    public static async Task<Results<Ok<ProviderStatus>, ProblemHttpResult>> SaveClaudeToken(SaveClaudeTokenRequest request, ClaudeConnection claude, CancellationToken cancellation)
    {
        var saved = await claude.SaveAsync(request, cancellation);

        return saved.Ok ? TypedResults.Ok(saved.Value) : saved.Problem.ToProblemResult();
    }

    [WolverineDelete("/api/ai-providers/claude/token")]
    public static Task<ProviderStatus> RemoveClaudeToken([FromServices] ClaudeConnection claude, CancellationToken cancellation) => claude.RemoveAsync(cancellation);
}
