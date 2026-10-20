using System.Text.RegularExpressions;
using DevSecrets.DevHub.Config;
using DevSecrets.DevHub.Models;
using Microsoft.Extensions.Options;
using Microsoft.Playwright;

namespace DevSecrets.DevHub.Browser;

// One browser case at a time, like one stack: it belongs to its owner, closes when idle too long, and leaves its
// video and trace on the host. Calls are serialized: the page is one thing.
public sealed partial class BrowserService(ConfigCatalog catalog, IOptions<DevHubOptions> options, TimeProvider time, ILogger<BrowserService> logger) : IAsyncDisposable
{
    private const string LocalValuesFile = "local";
    private const string RemoteValuesFile = "dev";

    private readonly SemaphoreSlim _gate = new(1, 1);
    private IPlaywright? _playwright;
    private IBrowser? _browser;
    private BrowserSession? _session;
    private DateTimeOffset _lastCallAt;

    public async Task<HubResult<BrowserView>> OpenAsync(OpenBrowserRequest request, CancellationToken cancellationToken)
    {
        var invalid = Validate(request);

        if (invalid is not null)
            return HubResult<BrowserView>.From(invalid);

        await _gate.WaitAsync(cancellationToken);

        try
        {
            if (_session is not null)
                return HubResult<BrowserView>.From(HubResult.Conflict($"A browser case is open ({_session.Case}, {Whose(_session)}). Close it first (DELETE /browser)."));

            _session = await BrowserSession.OpenAsync(await BrowserAsync(request.Headless ?? true), request, CaseFolder(request), Touch());

            if (request.Url is not null)
                await _session.Page.GotoAsync(request.Url, new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });

            return HubResult<BrowserView>.Ok(await _session.ViewAsync());
        }
        catch (Exception e) when (IsBrowserFailure(e))
        {
            // A missing browser (Start-DevHub.ps1 installs it) or a page that never loads is an answer, not a crash.
            return HubResult<BrowserView>.From(HubResult.Failed(Summary(e)));
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<HubResult<BrowserView>> ActAsync(BrowserAction action, CancellationToken cancellationToken)
    {
        var typed = TypedValue(action);
        var invalid = BrowserActions.Validate(action, typed);

        if (invalid is not null && !invalid.IsSuccess)
            return HubResult<BrowserView>.From(invalid);

        if (action.ValueName is not null && typed is null)
            return HubResult<BrowserView>.From(HubResult.NotFound($"No dev-secrets value {action.ValueName} in values.{LocalValuesFile}.json or values.{RemoteValuesFile}.json."));

        await _gate.WaitAsync(cancellationToken);

        try
        {
            if (_session is null)
                return HubResult<BrowserView>.From(NoCase());

            Touch();
            await BrowserActions.PerformAsync(_session.Page, action, typed);

            return HubResult<BrowserView>.Ok(await _session.ViewAsync());
        }
        catch (Exception e) when (IsBrowserFailure(e))
        {
            // An element that never appears, an unknown role: the agent reads why and picks another target.
            return HubResult<BrowserView>.From(HubResult.Invalid(Summary(e)));
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<HubResult<BrowserView>> SnapshotAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);

        try
        {
            if (_session is null)
                return HubResult<BrowserView>.From(NoCase());

            Touch();

            return HubResult<BrowserView>.Ok(await _session.ViewAsync());
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<BrowserStatus> GetStatusAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);

        try
        {
            if (_session is null)
                return BrowserStatus.Closed;

            return new BrowserStatus(true, _session.Owner, _session.Case, _session.Page.Url, await _session.Page.TitleAsync(), ExpiresAt());
        }
        finally
        {
            _gate.Release();
        }
    }

    // Without an owner it closes any case (a person at the console); with one, only that owner's.
    public async Task<HubResult<BrowserClosed>> CloseAsync(string? owner, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);

        try
        {
            if (_session is null)
                return HubResult<BrowserClosed>.From(NoCase());

            if (owner is not null && _session.Owner != owner)
                return HubResult<BrowserClosed>.From(HubResult.Conflict($"The browser case belongs to {_session.Owner}; only its owner closes it."));

            return HubResult<BrowserClosed>.Ok(await CloseSessionAsync());
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task CloseWhenIdleAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);

        try
        {
            if (_session is null || ExpiresAt() > time.GetUtcNow())
                return;

            logger.LogInformation("Browser case {Case} of {Owner} was idle too long: closing it", _session.Case, _session.Owner);
            await CloseSessionAsync();
        }
        finally
        {
            _gate.Release();
        }
    }

    public string[] ListArtifacts(string owner)
    {
        var folder = Path.Combine(options.Value.BrowserArtifactsDir, owner);

        if (!OwnerName().IsMatch(owner) || !Directory.Exists(folder))
            return [];

        return Directory.GetFiles(folder, "*", SearchOption.AllDirectories).Select(path => path.Replace('\\', '/')).Order(StringComparer.Ordinal).ToArray();
    }

    public async ValueTask DisposeAsync()
    {
        if (_session is not null)
            await CloseSessionAsync();

        if (_browser is not null)
            await _browser.DisposeAsync();

        _playwright?.Dispose();
    }

    private async Task<BrowserClosed> CloseSessionAsync()
    {
        var closed = await _session!.CloseAsync();

        _session = null;

        return closed;
    }

    private async Task<IBrowser> BrowserAsync(bool headless)
    {
        if (_browser is not null && _browser.IsConnected && _browserHeadless == headless)
            return _browser;

        if (_browser is not null)
            await _browser.DisposeAsync();

        _playwright ??= await Playwright.CreateAsync();
        _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions { Headless = headless, Channel = ChannelOrNull() });
        _browserHeadless = headless;

        return _browser;
    }

    private bool _browserHeadless = true;

    private string? ChannelOrNull() => string.IsNullOrWhiteSpace(options.Value.BrowserChannel) ? null : options.Value.BrowserChannel;

    private HubResult? Validate(OpenBrowserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Owner) || !OwnerName().IsMatch(request.Owner))
            return HubResult.Invalid("Pass an owner (letters, digits, - and _).");

        if (string.IsNullOrWhiteSpace(request.Case) || !CaseName().IsMatch(request.Case))
            return HubResult.Invalid("Pass a case name (letters, digits, . - and _; it names the recording's folder).");

        return null;
    }

    private string? TypedValue(BrowserAction action)
    {
        if (action.ValueName is null)
            return action.Value;

        return (catalog.GetSecret(LocalValuesFile, action.ValueName) ?? catalog.GetSecret(RemoteValuesFile, action.ValueName))?.Value;
    }

    private string CaseFolder(OpenBrowserRequest request) => Path.Combine(options.Value.BrowserArtifactsDir, request.Owner, request.Case);

    private DateTimeOffset Touch() => _lastCallAt = time.GetUtcNow();

    private DateTimeOffset ExpiresAt() => _lastCallAt.AddMinutes(options.Value.BrowserIdleMinutes);

    private static string Whose(BrowserSession session) => $"opened by {session.Owner}";

    private static HubResult NoCase() => HubResult.NotFound("No browser case is open (POST /browser opens one).");

    // Playwright 1.63 throws System.TimeoutException for an element that never appears, not its own exception type.
    private static bool IsBrowserFailure(Exception e) => e is PlaywrightException or TimeoutException or ArgumentException;

    // The first line names the failure; Playwright's call log adds what it waited for.
    private static string Summary(Exception e)
    {
        var lines = e.Message.Split('\n').Select(line => line.Trim()).Where(line => line.Length > 0 && line != "Call log:").Take(3);

        return string.Join(" ", lines);
    }

    [GeneratedRegex(@"^[A-Za-z0-9_-]+$")]
    private static partial Regex OwnerName();

    [GeneratedRegex(@"^[A-Za-z0-9][A-Za-z0-9._-]*$")]
    private static partial Regex CaseName();
}
