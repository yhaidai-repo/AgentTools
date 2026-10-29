using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using DevSecrets.DevHub.Config;
using DevSecrets.DevHub.Models;
using Microsoft.Extensions.Options;

namespace DevSecrets.DevHub;

public sealed partial class StackService(
    ScriptRunner runner,
    StackOperationTracker tracker,
    ServiceCatalog catalog,
    DevSecretsFiles files,
    IOptions<DevHubOptions> options,
    TimeProvider time,
    ILogger<StackService> logger
)
{
    private const string StartScript = "Start-LocalStack.ps1";
    private const string StatusScript = "Get-LocalStack.ps1";
    private const string StopScript = "Stop-LocalStack.ps1";
    private const int MaxLogLines = 2000;

    private static readonly JsonSerializerOptions ScriptJson = new() { PropertyNameCaseInsensitive = true };

    public async Task<HubResult> StartAsync(StartStackRequest request, CancellationToken cancellationToken)
    {
        var invalid = Validate(request);

        if (invalid is not null)
            return invalid;

        var status = await GetScriptStatusAsync(cancellationToken);

        if (status.Running)
            return HubResult.Conflict("A local stack is running. Stop it first (DELETE /stack).");

        var now = time.GetUtcNow();

        if (!tracker.TryBegin(request, now, now.AddMinutes(ResolveTtl(request.TtlMinutes))))
            return HubResult.Conflict("A stack is starting or stopping.");

        var process = runner.StartScript(StartScript, BuildStartArguments(request), tracker.AppendOutput);
        tracker.AttachStartProcess(process);
        _ = WatchStartAsync(process);

        return HubResult.Accepted();
    }

    public async Task<StackStatus> GetStatusAsync(CancellationToken cancellationToken)
    {
        var status = await GetScriptStatusAsync(cancellationToken);
        var operation = tracker.Current;

        return new StackStatus(
            operation.Phase,
            status.Running,
            operation.Services,
            operation.Branch,
            status.Environment,
            operation.StartedAt,
            operation.ExpiresAt,
            operation.ExitCode,
            operation.Owner,
            status.Services,
            tracker.Output,
            status.BuildIdentity,
            status.StrictBranch
        );
    }

    public async Task<string[]?> ReadLogAsync(string service, bool errorLog, int lines, CancellationToken cancellationToken)
    {
        var status = await GetScriptStatusAsync(cancellationToken);
        var entry = status.Services.FirstOrDefault(s => s.Name == service);
        var path = errorLog ? entry?.ErrorLog : entry?.Log;

        if (path is null || !File.Exists(path))
            return null;

        return ReadTail(path, Math.Clamp(lines, 1, MaxLogLines));
    }

    public async Task<HubResult> StopAsync(string? owner, CancellationToken cancellationToken)
    {
        if (!tracker.IsStoppableBy(owner))
            return HubResult.Conflict($"The stack belongs to {tracker.Current.Owner}; only its owner stops it.");

        await StopAsync(cancellationToken);

        return HubResult.Ok();
    }

    public async Task<IReadOnlyList<string>> StopAsync(CancellationToken cancellationToken)
    {
        KillStartScript(tracker.BeginStop());

        var output = await runner.RunScriptAsync(StopScript, [], cancellationToken);

        foreach (var line in output.Lines)
            tracker.AppendOutput(line);

        tracker.Reset();

        return output.Lines;
    }

    private HubResult? Validate(StartStackRequest request)
    {
        if (request.Services is not { Length: > 0 })
            return HubResult.Invalid("Pass at least one service (GET /services lists them).");

        var unknown = catalog.FindUnknown(request.Services);

        if (unknown.Length > 0)
            return HubResult.Invalid($"Unknown service(s): {string.Join(", ", unknown)}. GET /services lists them.");

        // Passed to pwsh as an argument: a value starting with '-' would be read as a parameter.
        if (request.Branch is not null && !BranchName().IsMatch(request.Branch))
            return HubResult.Invalid($"Invalid branch name: {request.Branch}");

        return EnvironmentRefusal(request.Environment) ?? ConfigRefusal(request);
    }

    // Config is keyed by a service in the stack that takes one; what it holds is the script's to check.
    private HubResult? ConfigRefusal(StartStackRequest request)
    {
        if (request.Config is null || request.Config.Count == 0)
            return null;

        var configurable = catalog.GetServices().Where(service => service.Configurable.Length > 0).Select(service => service.Name).ToHashSet(StringComparer.Ordinal);
        var refused = request.Config.Keys.Where(name => !request.Services.Contains(name) || !configurable.Contains(name)).ToArray();

        if (refused.Length > 0)
            return HubResult.Invalid($"Config for service(s) not in the stack or not configurable: {string.Join(", ", refused)}. GET /services shows what each takes.");

        return null;
    }

    // An environment is a values file; the name also goes to pwsh as an argument.
    private HubResult? EnvironmentRefusal(string? environment)
    {
        if (environment is null || files.ValuesFileNames().Contains(environment))
            return null;

        return HubResult.Invalid($"Unknown environment {environment}: one of {string.Join(", ", files.ValuesFileNames())}.");
    }

    private int ResolveTtl(int? requested) =>
        Math.Clamp(requested ?? options.Value.DefaultTtlMinutes, 1, options.Value.MaxTtlMinutes);

    private static List<string> BuildStartArguments(StartStackRequest request)
    {
        var arguments = new List<string> { "-Services", string.Join(',', request.Services) };

        if (request.StrictBranch) arguments.Add("-StrictBranch");
        if (!string.IsNullOrEmpty(request.Branch))
            arguments.AddRange(["-Branch", request.Branch]);

        if (!string.IsNullOrEmpty(request.Environment))
            arguments.AddRange(["-Values", request.Environment]);

        if (request.Config is { Count: > 0 })
            arguments.AddRange(["-Config", JsonSerializer.Serialize(request.Config)]);

        return arguments;
    }

    private async Task WatchStartAsync(Process process)
    {
        try
        {
            await process.WaitForExitAsync();
            tracker.CompleteStart(process.ExitCode);
            logger.LogInformation("Start-LocalStack exited with {ExitCode}", process.ExitCode);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Watching Start-LocalStack failed");
            tracker.CompleteStart(-1);
        }
        finally
        {
            process.Dispose();
        }
    }

    private void KillStartScript(Process? startProcess)
    {
        if (startProcess is null || startProcess.HasExited)
            return;

        // The services it already started are its children; Stop-LocalStack cleans up the rest.
        logger.LogInformation("Killing the running Start-LocalStack");
        startProcess.Kill(entireProcessTree: true);
    }

    private async Task<ScriptStackStatus> GetScriptStatusAsync(CancellationToken cancellationToken)
    {
        var output = await runner.RunScriptAsync(StatusScript, ["-Json"], cancellationToken);

        if (output.ExitCode != 0)
            throw new InvalidOperationException($"{StatusScript} failed: {string.Join(Environment.NewLine, output.Lines)}");

        return JsonSerializer.Deserialize<ScriptStackStatus>(string.Join('\n', output.Lines), ScriptJson) ?? ScriptStackStatus.None;
    }

    private static string[] ReadTail(string path, int lines)
    {
        // The running service keeps its log open for writing.
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        using var reader = new StreamReader(stream);
        var all = reader.ReadToEnd().Split('\n');

        return all.TakeLast(lines).Select(line => line.TrimEnd('\r')).ToArray();
    }

    [GeneratedRegex(@"^[A-Za-z0-9][A-Za-z0-9._/-]*$")]
    private static partial Regex BranchName();
}
