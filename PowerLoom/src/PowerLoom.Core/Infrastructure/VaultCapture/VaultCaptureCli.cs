using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Options;
using PowerLoom.Contracts;
using PowerLoom.Infrastructure.VaultCapture.Models;
using PowerLoom.Infrastructure.Vaults;

namespace PowerLoom.Infrastructure.VaultCapture;

// Runs `pwsh vault-capture.ps1 <command> -VaultRoot <vault>` with JSON on stdin. The CLI prints one JSON result (also
// when it rejects, with exit code 1); anything else is a failure to report.
public sealed class VaultCaptureCli(IOptions<VaultCaptureOptions> options, VaultRoots roots) : IVaultCapture
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(60);
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<Outcome<string>> AddRegisterRecordAsync(string vault, NewRegisterRecord record, CancellationToken cancellation)
    {
        var input = JsonSerializer.Serialize(new { vault, record.Project, record.Kind, record.Title, record.Text, record.Default, record.Options }, Json);
        var result = await RunAsync(["register-add"], vault, input, cancellation);

        if (!result.Ok)
            return Outcome<string>.Failure(Problem.Invalid(string.Join("; ", result.Errors ?? ["rejected"])));

        return Outcome<string>.Success(result.Id?.ToString() ?? "");
    }

    public async Task<DraftCaptureResult> CaptureDraftAsync(string vault, DraftCapture draft, CancellationToken cancellation)
    {
        var input = JsonSerializer.Serialize(new { vault, draft.Project, draft.Name, draft.Title, draft.Source, draft.Target, draft.Captured, draft.Assumptions, draft.ToFill }, Json);
        var output = await RunAsync<CaptureOutput>(["capture"], vault, input, cancellation);

        return new DraftCaptureResult(output.Ok, output.Mode ?? "rejected", output.Path is null ? null : RelativePath(vault, output.Path), output.Errors ?? []);
    }

    public async Task<IReadOnlyList<VaultDraft>> ListDraftsAsync(string vault, string preferSource, CancellationToken cancellation)
    {
        var output = await RunAsync<DraftListOutput>(["drafts", "-Vault", vault, "-PreferSource", preferSource], vault, "", cancellation);

        if (!output.Ok)
            throw new InvalidOperationException($"VaultCapture drafts failed: {string.Join("; ", output.Errors ?? [])}");

        return (output.Drafts ?? []).Select(draft => draft with { Path = RelativePath(vault, draft.Path) }).ToList();
    }

    public async Task<IReadOnlyDictionary<string, bool>> IsDraftAsync(string vault, IReadOnlyCollection<string> names, CancellationToken cancellation)
    {
        if (names.Count == 0)
            return new Dictionary<string, bool>();

        var arguments = new[] { "is-draft", "-Vault", vault }.Concat(names.SelectMany(name => new[] { "-Name", name }));
        var output = await RunAsync<IsDraftOutput>(arguments, vault, "", cancellation);

        if (!output.Ok)
            throw new InvalidOperationException($"VaultCapture is-draft failed: {string.Join("; ", output.Errors ?? [])}");

        return output.Drafts ?? [];
    }

    // Draft paths as stored: relative to the docs vault (e.g. draft/pvs-topic.md).
    private string RelativePath(string vault, string path) => Path.GetRelativePath(roots.RootOf(vault), path).Replace('\\', '/');

    private Task<VaultCaptureResult> RunAsync(IEnumerable<string> arguments, string vault, string input, CancellationToken cancellation) => RunAsync<VaultCaptureResult>(arguments, vault, input, cancellation);

    private async Task<T> RunAsync<T>(IEnumerable<string> arguments, string vault, string input, CancellationToken cancellation)
    {
        using var process = Process.Start(StartInfo(arguments, vault)) ?? throw new InvalidOperationException("could not start pwsh for VaultCapture");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);

        timeout.CancelAfter(Timeout);
        await process.StandardInput.WriteAsync(input);
        process.StandardInput.Close();

        var stdout = process.StandardOutput.ReadToEndAsync(timeout.Token);
        var stderr = process.StandardError.ReadToEndAsync(timeout.Token);

        await process.WaitForExitAsync(timeout.Token);

        return ParseOutput<T>(await stdout, await stderr, process.ExitCode);
    }

    private ProcessStartInfo StartInfo(IEnumerable<string> arguments, string vault)
    {
        var home = options.Value.Home;

        if (string.IsNullOrWhiteSpace(home))
            throw new InvalidOperationException("VaultCapture:Home is not set: the folder with vault-capture.ps1.");

        var start = new ProcessStartInfo("pwsh") { RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };

        foreach (var argument in new[] { "-NoProfile", "-NonInteractive", "-File", Path.Combine(home, "vault-capture.ps1") }.Concat(arguments).Concat(["-VaultRoot", roots.RootOf(vault)]))
            start.ArgumentList.Add(argument);

        // The module takes the vault as a parameter: no configuration file, no colours in the output.
        start.Environment["VAULT_CAPTURE_CONFIG"] = "/nonexistent/vault-capture.config.json";
        start.Environment["NO_COLOR"] = "1";

        return start;
    }

    private static T ParseOutput<T>(string stdout, string stderr, int exitCode)
    {
        var lastLine = stdout.Trim().Split('\n').LastOrDefault()?.Trim() ?? "";

        try
        {
            return JsonSerializer.Deserialize<T>(lastLine, Json) ?? throw new JsonException("empty result");
        }
        catch (JsonException)
        {
            var detail = (string.IsNullOrWhiteSpace(stderr) ? stdout : stderr).Trim();

            throw new InvalidOperationException($"VaultCapture exited with {exitCode}: {detail[..Math.Min(detail.Length, 500)]}");
        }
    }
}
