using System.Text.Json;
using PowerLoom.Contracts;
using PowerLoom.Features.AiProviders.Models;
using PowerLoom.Infrastructure.Runner;

namespace PowerLoom.Features.AiProviders;

// Proxies the runner's `/codex/*`; the backend never holds Codex's login. The statuses the pages ask for on load wait
// briefly: GET /api/ai-providers is behind the dashboard, Settings and Agents pages.
public sealed class RunnerCodexLogin(RunnerHttp runner) : ICodexLogin
{
    public Task<Outcome<RunnerCodexStatus>> StatusAsync(CancellationToken cancellation) => runner.GetAsync<RunnerCodexStatus>("/codex/status", cancellation, RunnerHttp.StatusTimeout);

    public Task<Outcome<CodexLoginStart>> StartAsync(CancellationToken cancellation) => runner.PostAsync<CodexLoginStart>("/codex/login/start", new { }, cancellation);

    public Task<Outcome<CodexLoginStatus>> LoginStatusAsync(CancellationToken cancellation) => runner.GetAsync<CodexLoginStatus>("/codex/login/status", cancellation, RunnerHttp.StatusTimeout);

    public async Task<Outcome<bool>> SignOutAsync(CancellationToken cancellation) => Done(await runner.DeleteAsync<JsonElement>("/codex/login", cancellation));

    public async Task<Outcome<bool>> SaveLoginFileAsync(string authJson, CancellationToken cancellation) => Done(await runner.PutAsync<JsonElement>("/codex/login-file", new RunnerCodexLoginFile(authJson), cancellation));

    private static Outcome<bool> Done(Outcome<JsonElement> answer) => answer.Ok ? Outcome<bool>.Success(true) : Outcome<bool>.Failure(answer.Problem);
}
