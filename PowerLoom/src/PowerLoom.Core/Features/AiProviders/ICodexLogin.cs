using PowerLoom.Contracts;
using PowerLoom.Features.AiProviders.Models;

namespace PowerLoom.Features.AiProviders;

// Codex's login in PowerLoom's Codex home, kept by the agent-runner (it owns the home and runs `codex login`).
public interface ICodexLogin
{
    Task<Outcome<RunnerCodexStatus>> StatusAsync(CancellationToken cancellation);

    Task<Outcome<CodexLoginStart>> StartAsync(CancellationToken cancellation);

    Task<Outcome<CodexLoginStatus>> LoginStatusAsync(CancellationToken cancellation);

    Task<Outcome<CodexLoginStatus>> CancelAsync(CancellationToken cancellation);

    Task<Outcome<bool>> SignOutAsync(CancellationToken cancellation);

    Task<Outcome<bool>> SaveLoginFileAsync(string authJson, CancellationToken cancellation);
}
