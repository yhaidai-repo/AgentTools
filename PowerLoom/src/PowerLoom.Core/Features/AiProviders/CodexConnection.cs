using PowerLoom.Contracts;
using PowerLoom.Features.AiProviders.Models;

namespace PowerLoom.Features.AiProviders;

// Settings → AI providers → Codex: agents on Codex models run on the user's ChatGPT plan, signed in to PowerLoom's own
// Codex home (never the user's ~/.codex) with a device code, or with a login file when that fails.
public sealed class CodexConnection(ICodexLogin login)
{
    public const string Provider = "openai-codex";
    public const string Label = "Codex";

    private const string NoLoginFile = "Choose the auth.json of a PC where `codex login` worked.";

    // An agent-runner that can't be asked counts as not connected: no run could use Codex then either.
    public async Task<ProviderStatus> StatusAsync(CancellationToken cancellation)
    {
        var answer = await login.StatusAsync(cancellation);

        return Status(answer.Ok && answer.Value.Connected);
    }

    public async Task<bool> IsConnectedAsync(CancellationToken cancellation) => (await StatusAsync(cancellation)).Connected;

    public Task<Outcome<CodexLoginStart>> StartAsync(CancellationToken cancellation) => login.StartAsync(cancellation);

    public Task<Outcome<CodexLoginStatus>> LoginStatusAsync(CancellationToken cancellation) => login.LoginStatusAsync(cancellation);

    public Task<Outcome<CodexLoginStatus>> CancelAsync(CancellationToken cancellation) => login.CancelAsync(cancellation);

    public async Task<Outcome<ProviderStatus>> DisconnectAsync(CancellationToken cancellation)
    {
        var signedOut = await login.SignOutAsync(cancellation);

        return signedOut.Ok ? Outcome<ProviderStatus>.Success(await StatusAsync(cancellation)) : Outcome<ProviderStatus>.Failure(signedOut.Problem);
    }

    public async Task<Outcome<ProviderStatus>> SaveLoginFileAsync(SaveCodexLoginFileRequest request, CancellationToken cancellation)
    {
        if (string.IsNullOrWhiteSpace(request.AuthJson))
            return Outcome<ProviderStatus>.Failure(Problem.Invalid(NoLoginFile));

        var saved = await login.SaveLoginFileAsync(request.AuthJson, cancellation);

        return saved.Ok ? Outcome<ProviderStatus>.Success(await StatusAsync(cancellation)) : Outcome<ProviderStatus>.Failure(saved.Problem);
    }

    private static ProviderStatus Status(bool connected) => new(Provider, Label, connected, connected ? ProviderSource.Settings : null);
}
