using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.GitHubIntegration.Features.Connection.Models;
using PowerLoom.GitHubIntegration.Features.SyncPullRequests;
using PowerLoom.GitHubIntegration.Features.SyncRepositories;
using PowerLoom.Contracts;
using PowerLoom.GitHubIntegration.Settings;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Scheduling;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.GitHubIntegration.Features.Connection;

// Settings → Repositories → GitHub (user decision 2026-10-25): the vault's switch, token and owner, the test, and the
// catalog sync (also on save).
public static class GitHubEndpoints
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverinePut("/api/vaults/{vault}/github")]
    public static async Task<Results<Ok<GitHubSummary>, ProblemHttpResult>> Save(string vault, SaveGitHubRequest request, GitHubConnection connection, IMessageBus bus, CancellationToken cancellation)
    {
        var saved = await connection.SaveAsync(vault, request, cancellation);

        if (!saved.Ok)
            return saved.Problem!.ToProblemResult();

        if (saved.Value!.IsActive)
            await bus.PublishAsync(new SyncGitHubRepositories(vault));

        return TypedResults.Ok(GitHubConnection.SummaryOf(saved.Value));
    }

    [WolverinePost("/api/vaults/{vault}/github/test")]
    public static async Task<Ok<GitHubCheck>> Test(string vault, TestGitHubRequest request, GitHubConnection connection, CancellationToken cancellation)
    {
        return TypedResults.Ok(await connection.TestAsync(vault, request, cancellation));
    }

    [WolverinePost("/api/vaults/{vault}/github/sync")]
    public static async Task<Accepted> Sync(string vault, IMessageBus bus)
    {
        await bus.PublishAsync(new SyncGitHubRepositories(vault));

        return TypedResults.Accepted((string?)null);
    }

    // Settings → Sync: the pull request check's switch and schedule.
    [WolverinePut("/api/vaults/{vault}/github/pull-requests")]
    public static async Task<Results<Ok<GitHubSummary>, ProblemHttpResult>> SavePullRequests(string vault, SaveGitHubPullRequestsRequest request, GitHubSettingsStore store, CancellationToken cancellation)
    {
        if (!CronDue.IsValid(request.Cron.Trim()))
            return Problem.Invalid($"\"{request.Cron}\" isn't a cron expression (five fields, e.g. */30 * * * *).").ToProblemResult();

        var settings = await store.ReadAsync(vault, cancellation);

        settings.PullRequestsEnabled = request.Enabled;
        settings.PullRequestsCron = request.Cron.Trim();
        await store.SaveAsync(vault, settings, cancellation);

        return TypedResults.Ok(GitHubConnection.SummaryOf(settings));
    }

    // Reviews → Check now: the vault's GitHub pull requests.
    [WolverinePost("/api/vaults/{vault}/github/pull-requests/sync")]
    public static async Task<Accepted> SyncPullRequests(string vault, IMessageBus bus)
    {
        await bus.PublishAsync(new SyncGitHubPullRequests(vault));

        return TypedResults.Accepted((string?)null);
    }
}
