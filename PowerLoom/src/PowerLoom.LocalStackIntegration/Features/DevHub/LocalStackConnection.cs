using PowerLoom.Contracts;
using PowerLoom.LocalStackIntegration.Features.DevHub.Models;
using PowerLoom.LocalStackIntegration.Settings;

namespace PowerLoom.LocalStackIntegration.Features.DevHub;

// Settings → Local stack: the vault's switch, DevHub's URL and its token (written once, never read back).
public sealed class LocalStackConnection(LocalStackSettingsStore store)
{
    private const string NoToken = "Enter DevHub's token: the dev-secrets value dev-hub-token (Start-DevHub.ps1 creates it).";

    public async Task<Outcome<LocalStackSettings>> SaveAsync(string vault, SaveLocalStackRequest request, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var url = UrlOrDefault(request.Url);
        var token = TokenOrSaved(request.Token, settings);
        var problem = ProblemOf(url, token, request.Enabled);

        if (problem is not null)
            return Outcome<LocalStackSettings>.Failure(problem);

        settings.Enabled = request.Enabled;
        settings.Url = url;
        settings.Token = token;
        await store.SaveAsync(vault, settings, cancellation);

        return Outcome<LocalStackSettings>.Success(settings);
    }

    // The typed URL and token, the saved ones for empty fields.
    public async Task<Outcome<LocalStackTarget>> TestTargetAsync(string vault, TestLocalStackRequest request, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var url = string.IsNullOrWhiteSpace(request.Url) ? settings.Url : request.Url.Trim();
        var token = TokenOrSaved(request.Token, settings);
        var problem = ProblemOf(url, token, enabled: true);

        return problem is null ? Outcome<LocalStackTarget>.Success(new LocalStackTarget(url, token)) : Outcome<LocalStackTarget>.Failure(problem);
    }

    public static LocalStackSummary SummaryOf(LocalStackSettings settings) => new(settings.Enabled, settings.Url, settings.Token.Length > 0);

    private static string UrlOrDefault(string? url) => string.IsNullOrWhiteSpace(url) ? LocalStackSettings.DefaultUrl : url.Trim().TrimEnd('/');

    private static string TokenOrSaved(string? token, LocalStackSettings settings) => string.IsNullOrWhiteSpace(token) ? settings.Token : token.Trim();

    // A switched-on vault needs a token: without one DevHub refuses every call.
    private static Problem? ProblemOf(string url, string token, bool enabled)
    {
        if (!IsHttpUrl(url))
            return Problem.Invalid($"Not an http(s) URL: {url}. DevHub is {LocalStackSettings.DefaultUrl} from the agent-runner.");

        return enabled && token.Length == 0 ? Problem.Invalid(NoToken) : null;
    }

    private static bool IsHttpUrl(string url) => Uri.TryCreate(url, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
}
