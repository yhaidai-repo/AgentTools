using System.IO.Compression;
using System.Text.RegularExpressions;
using DevSecrets.DevHub.Models;
using Microsoft.Extensions.Options;

namespace DevSecrets.DevHub.Browser;

// One browser case at a time, like one stack: a Playwright MCP process the agent drives through `/browser/mcp`. The
// case belongs to its owner, closes when idle too long, and leaves its video, trace and screenshots on the host.
public sealed partial class BrowserService(SecretsFile secrets, IOptions<DevHubOptions> options, TimeProvider time, ILogger<BrowserService> logger) : IAsyncDisposable
{
    private const string TracesFolder = "traces";
    private const string TraceZip = "trace.zip";
    private const string SecretsFileName = "mcp-secrets.env";
    private static readonly TimeSpan GracefulClose = TimeSpan.FromSeconds(20);

    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly HttpClient _http = new();
    private OpenCase? _case;

    public bool IsOpen => _case is not null;

    public int McpPort => options.Value.McpPort;

    public async Task<HubResult<BrowserStatus>> OpenAsync(OpenBrowserRequest request, CancellationToken cancellationToken)
    {
        var invalid = Validate(request);

        if (invalid is not null)
            return HubResult<BrowserStatus>.From(invalid);

        await _gate.WaitAsync(cancellationToken);

        try
        {
            if (_case is not null)
                return HubResult<BrowserStatus>.From(HubResult.Conflict($"A browser case is open ({_case.Case}, opened by {_case.Owner}). Close it first (DELETE /browser)."));

            _case = await StartCaseAsync(request, cancellationToken);

            return HubResult<BrowserStatus>.Ok(Status());
        }
        catch (Exception e) when (e is InvalidOperationException or IOException or OperationCanceledException)
        {
            return HubResult<BrowserStatus>.From(HubResult.Failed($"The browser case didn't start: {e.Message}"));
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task ProxyAsync(HttpContext context)
    {
        var open = _case;

        if (open is null)
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            await context.Response.WriteAsync("No browser case is open (POST /browser opens one).");

            return;
        }

        Touch(open);
        await McpProxy.ForwardAsync(context, _http, open.Process.Port, session => open.Session.SessionId = session);
    }

    public async Task<HubResult<McpToolAnswer>> TypeSecretAsync(TypeSecretRequest request, CancellationToken cancellationToken)
    {
        var value = secrets.Resolve(request.ValueName);

        if (value is null)
            return HubResult<McpToolAnswer>.From(HubResult.NotFound($"No dev-secrets value {request.ValueName}."));

        await _gate.WaitAsync(cancellationToken);

        try
        {
            if (_case is null)
                return HubResult<McpToolAnswer>.From(NoCase());

            Touch(_case);

            var answer = await _case.Session.CallToolAsync("browser_type", new { element = request.Element, target = request.Target, text = value, submit = request.Submit ?? false }, cancellationToken);

            // The MCP redacts known secrets itself; this is the belt to its braces.
            return HubResult<McpToolAnswer>.Ok(answer with { Text = answer.Text.Replace(value, "<secret>") });
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
            return Status();
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
            if (_case is null)
                return HubResult<BrowserClosed>.From(NoCase());

            if (owner is not null && _case.Owner != owner)
                return HubResult<BrowserClosed>.From(HubResult.Conflict($"The browser case belongs to {_case.Owner}; only its owner closes it."));

            return HubResult<BrowserClosed>.Ok(await CloseCaseAsync());
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
            if (_case is null || ExpiresAt(_case) > time.GetUtcNow())
                return;

            logger.LogInformation("Browser case {Case} of {Owner} was idle too long: closing it", _case.Case, _case.Owner);
            await CloseCaseAsync();
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

        return ArtifactFiles(folder);
    }

    // Every owner with a recordings folder, for PowerLoom's cleanup to judge by its runs.
    public OwnerArtifacts[] ListOwners()
    {
        var root = options.Value.BrowserArtifactsDir;

        if (!Directory.Exists(root))
            return [];

        return Directory.GetDirectories(root).Select(folder => OwnerOf(new DirectoryInfo(folder))).OrderBy(owner => owner.Owner, StringComparer.Ordinal).ToArray();
    }

    // Removes an owner's recordings folder (a dry run only measures it); refused while that owner's case is open.
    public HubResult<DeletedArtifacts> DeleteArtifacts(string owner, bool dryRun)
    {
        var folder = Path.Combine(options.Value.BrowserArtifactsDir, owner);

        if (!OwnerName().IsMatch(owner))
            return HubResult<DeletedArtifacts>.From(HubResult.Invalid("Pass an owner (letters, digits, - and _)."));

        if (_case?.Owner == owner)
            return HubResult<DeletedArtifacts>.From(HubResult.Conflict($"{owner} has a browser case open; close it first."));

        if (!Directory.Exists(folder))
            return HubResult<DeletedArtifacts>.From(HubResult.NotFound($"{owner} has no recordings."));

        var files = ArtifactFiles(folder);
        var bytes = files.Sum(file => new FileInfo(file).Length);

        if (!dryRun)
            Directory.Delete(folder, recursive: true);

        return HubResult<DeletedArtifacts>.Ok(new DeletedArtifacts(owner, files.Length, bytes, dryRun));
    }

    private static OwnerArtifacts OwnerOf(DirectoryInfo folder)
    {
        var files = folder.EnumerateFiles("*", SearchOption.AllDirectories).ToList();
        var newest = files.Count == 0 ? folder.LastWriteTimeUtc : files.Max(file => file.LastWriteTimeUtc);

        return new OwnerArtifacts(folder.Name, files.Sum(file => file.Length), new DateTimeOffset(newest, TimeSpan.Zero));
    }

    public async ValueTask DisposeAsync()
    {
        if (_case is not null)
            await CloseCaseAsync();

        _http.Dispose();
    }

    private async Task<OpenCase> StartCaseAsync(OpenBrowserRequest request, CancellationToken cancellationToken)
    {
        var folder = Path.Combine(options.Value.BrowserArtifactsDir, request.Owner, request.Case);

        Directory.CreateDirectory(folder);

        var secretsPath = secrets.Write(folder);
        var headless = request.Headless ?? true;
        var process = await McpProcess.StartAsync(options.Value, folder, secretsPath, headless, cancellationToken);

        return new OpenCase(request.Owner, request.Case, headless, folder, process, new McpSession(_http, process.Port), time.GetUtcNow()) { LastCallAt = time.GetUtcNow() };
    }

    // The recordings are written when the MCP stops them and closes the browser, so that comes before the kill; a
    // case the agent never drove (no session) has nothing to stop. The trace folder becomes trace.zip for the viewer.
    private async Task<BrowserClosed> CloseCaseAsync()
    {
        var open = _case!;

        await StopRecordingsAsync(open);
        open.Process.Dispose();
        ZipTrace(open.Folder);
        File.Delete(Path.Combine(open.Folder, SecretsFileName));
        _case = null;

        return new BrowserClosed(open.Case, ArtifactFiles(open.Folder));
    }

    private async Task StopRecordingsAsync(OpenCase open)
    {
        if (open.Session.SessionId is null || open.Process.HasExited)
            return;

        using var timeout = new CancellationTokenSource(GracefulClose);

        foreach (var tool in new[] { "browser_stop_video", "browser_stop_tracing", "browser_close" })
        {
            try
            {
                await open.Session.CallToolAsync(tool, new { }, timeout.Token);
            }
            catch (Exception e) when (e is HttpRequestException or OperationCanceledException)
            {
                logger.LogWarning("{Tool} on close failed: {Message}", tool, e.Message);
            }
        }
    }

    private static void ZipTrace(string folder)
    {
        var traces = Path.Combine(folder, TracesFolder);

        if (!Directory.Exists(traces))
            return;

        ZipFile.CreateFromDirectory(traces, Path.Combine(folder, TraceZip));
        Directory.Delete(traces, recursive: true);
    }

    private static string[] ArtifactFiles(string folder) =>
        Directory.GetFiles(folder, "*", SearchOption.AllDirectories)
            .Where(path => Path.GetFileName(path) != SecretsFileName)
            .Select(path => path.Replace('\\', '/'))
            .Order(StringComparer.Ordinal)
            .ToArray();

    private BrowserStatus Status() =>
        _case is null ? BrowserStatus.Closed : new BrowserStatus(true, _case.Owner, _case.Case, _case.Headless, _case.StartedAt, ExpiresAt(_case), _case.Session.SessionId is not null);

    private HubResult? Validate(OpenBrowserRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Owner) || !OwnerName().IsMatch(request.Owner))
            return HubResult.Invalid("Pass an owner (letters, digits, - and _).");

        if (string.IsNullOrWhiteSpace(request.Case) || !CaseName().IsMatch(request.Case))
            return HubResult.Invalid("Pass a case name (letters, digits, . - and _; it names the recording's folder).");

        if (!File.Exists(Path.Combine(options.Value.McpDir, "node_modules", "@playwright", "mcp", "cli.js")))
            return HubResult.Failed($"The Playwright MCP isn't installed under {options.Value.McpDir} (Start-DevHub.ps1 installs it).");

        return null;
    }

    private void Touch(OpenCase open) => open.LastCallAt = time.GetUtcNow();

    private DateTimeOffset ExpiresAt(OpenCase open) => open.LastCallAt.AddMinutes(options.Value.BrowserIdleMinutes);

    private static HubResult NoCase() => HubResult.NotFound("No browser case is open (POST /browser opens one).");

    [GeneratedRegex(@"^[A-Za-z0-9_-]+$")]
    private static partial Regex OwnerName();

    [GeneratedRegex(@"^[A-Za-z0-9][A-Za-z0-9._-]*$")]
    private static partial Regex CaseName();
}
