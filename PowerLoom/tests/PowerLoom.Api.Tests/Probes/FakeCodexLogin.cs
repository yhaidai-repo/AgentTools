using PowerLoom.Contracts;
using PowerLoom.Features.AiProviders;
using PowerLoom.Features.AiProviders.Models;

namespace PowerLoom.Api.Tests.Probes;

// The agent-runner's Codex login, held in memory: tests sign in, fail or take the runner away.
public sealed class FakeCodexLogin : ICodexLogin
{
    public bool Connected { get; set; }

    public bool Unreachable { get; set; }

    public string? SavedLoginFile { get; private set; }

    public CodexLoginStart Start { get; set; } = new("https://auth.openai.com/codex/device", "ABCD-12345", "Open the link and enter the code.");

    public Task<Outcome<RunnerCodexStatus>> StatusAsync(CancellationToken cancellation) => Answer(new RunnerCodexStatus(Connected));

    public Task<Outcome<CodexLoginStart>> StartAsync(CancellationToken cancellation) => Answer(Start);

    public bool Cancelled { get; private set; }

    public Task<Outcome<CodexLoginStatus>> LoginStatusAsync(CancellationToken cancellation) => Answer(new CodexLoginStatus(Connected ? "done" : "pending", null, ""));

    public Task<Outcome<CodexLoginStatus>> CancelAsync(CancellationToken cancellation)
    {
        Cancelled = true;

        return Answer(new CodexLoginStatus("none", null, ""));
    }

    public Task<Outcome<bool>> SignOutAsync(CancellationToken cancellation)
    {
        Connected = false;

        return Answer(true);
    }

    public Task<Outcome<bool>> SaveLoginFileAsync(string authJson, CancellationToken cancellation)
    {
        SavedLoginFile = authJson;
        Connected = true;

        return Answer(true);
    }

    public void Reset()
    {
        Connected = false;
        Unreachable = false;
        SavedLoginFile = null;
        Cancelled = false;
    }

    private Task<Outcome<T>> Answer<T>(T value)
        where T : notnull
    {
        return Task.FromResult(Unreachable ? Outcome<T>.Failure(new Problem(503, "The agent-runner can't be reached: test")) : Outcome<T>.Success(value));
    }
}
