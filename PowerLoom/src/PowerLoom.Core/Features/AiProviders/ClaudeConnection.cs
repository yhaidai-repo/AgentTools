using PowerLoom.Contracts;
using PowerLoom.Features.AiProviders.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Features.AiProviders;

// Settings → AI providers → Claude: one token for the whole PowerLoom (`claude setup-token`), written once and never read
// back. The agent-runner uses it for every run; without one it falls back to CLAUDE_CODE_OAUTH_TOKEN from .env, which
// it reports at start-up (the API never holds that secret).
public sealed class ClaudeConnection(PowerLoomDbContext db)
{
    // The TypeScript side reads the same keys: {"token": "..."} and {"present": true}.
    public const string TokenKey = "claudeToken";
    public const string EnvTokenKey = "claudeEnvToken";

    public const string Provider = "anthropic";
    public const string Label = "Claude";

    private const string NoToken = "Paste the token `claude setup-token` prints.";

    public async Task<ProviderStatus> StatusAsync(CancellationToken cancellation)
    {
        var saved = await GlobalSettings.ReadAsync<ClaudeTokenSetting>(db, TokenKey, cancellation);

        if (!string.IsNullOrEmpty(saved?.Token))
            return Status(ProviderSource.Settings);

        var env = await GlobalSettings.ReadAsync<EnvTokenReport>(db, EnvTokenKey, cancellation);

        return Status(env?.Present == true ? ProviderSource.Env : null);
    }

    public async Task<Outcome<ProviderStatus>> SaveAsync(SaveClaudeTokenRequest request, CancellationToken cancellation)
    {
        var token = request.Token?.Trim() ?? "";

        if (token.Length == 0 || token.Any(char.IsWhiteSpace))
            return Outcome<ProviderStatus>.Failure(Problem.Invalid(NoToken));

        await GlobalSettings.SaveAsync(db, TokenKey, new ClaudeTokenSetting { Token = token }, cancellation);

        return Outcome<ProviderStatus>.Success(await StatusAsync(cancellation));
    }

    // Removing the saved token leaves the .env fallback, if the runner has one.
    public async Task<ProviderStatus> RemoveAsync(CancellationToken cancellation)
    {
        await GlobalSettings.DeleteAsync(db, TokenKey, cancellation);

        return await StatusAsync(cancellation);
    }

    private static ProviderStatus Status(ProviderSource? source) => new(Provider, Label, source is not null, source);
}
