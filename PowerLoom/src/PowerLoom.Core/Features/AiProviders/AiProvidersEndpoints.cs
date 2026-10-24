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
    public static async Task<IReadOnlyList<ProviderStatus>> List(ClaudeConnection claude, CodexConnection codex, CancellationToken cancellation)
    {
        return [await claude.StatusAsync(cancellation), await codex.StatusAsync(cancellation)];
    }

    [WolverinePut("/api/ai-providers/claude/token")]
    public static async Task<Results<Ok<ProviderStatus>, ProblemHttpResult>> SaveClaudeToken(SaveClaudeTokenRequest request, ClaudeConnection claude, CancellationToken cancellation)
    {
        var saved = await claude.SaveAsync(request, cancellation);

        return saved.Ok ? TypedResults.Ok(saved.Value) : saved.Problem.ToProblemResult();
    }

    [WolverineDelete("/api/ai-providers/claude/token")]
    public static Task<ProviderStatus> RemoveClaudeToken([FromServices] ClaudeConnection claude, CancellationToken cancellation) => claude.RemoveAsync(cancellation);

    // Connect Codex: the link and code come back at once; the page then asks for the sign-in's status.
    [WolverinePost("/api/ai-providers/codex/login")]
    public static async Task<Results<Ok<CodexLoginStart>, ProblemHttpResult>> StartCodexLogin([FromServices] CodexConnection codex, CancellationToken cancellation)
    {
        var started = await codex.StartAsync(cancellation);

        return started.Ok ? TypedResults.Ok(started.Value) : started.Problem.ToProblemResult();
    }

    [WolverineGet("/api/ai-providers/codex/login")]
    public static async Task<Results<Ok<CodexLoginStatus>, ProblemHttpResult>> CodexSignInStatus(CodexConnection codex, CancellationToken cancellation)
    {
        var status = await codex.LoginStatusAsync(cancellation);

        return status.Ok ? TypedResults.Ok(status.Value) : status.Problem.ToProblemResult();
    }

    [WolverineDelete("/api/ai-providers/codex/login")]
    public static async Task<Results<Ok<ProviderStatus>, ProblemHttpResult>> DisconnectCodex([FromServices] CodexConnection codex, CancellationToken cancellation)
    {
        var disconnected = await codex.DisconnectAsync(cancellation);

        return disconnected.Ok ? TypedResults.Ok(disconnected.Value) : disconnected.Problem.ToProblemResult();
    }

    [WolverinePut("/api/ai-providers/codex/login-file")]
    public static async Task<Results<Ok<ProviderStatus>, ProblemHttpResult>> SaveCodexLoginFile(SaveCodexLoginFileRequest request, CodexConnection codex, CancellationToken cancellation)
    {
        var saved = await codex.SaveLoginFileAsync(request, cancellation);

        return saved.Ok ? TypedResults.Ok(saved.Value) : saved.Problem.ToProblemResult();
    }
}
