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

    private async Task<VaultCaptureResult> RunAsync(IEnumerable<string> arguments, string vault, string input, CancellationToken cancellation)
    {
        using var process = Process.Start(StartInfo(arguments, vault)) ?? throw new InvalidOperationException("could not start pwsh for VaultCapture");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);

        timeout.CancelAfter(Timeout);
        await process.StandardInput.WriteAsync(input);
        process.StandardInput.Close();

        var stdout = process.StandardOutput.ReadToEndAsync(timeout.Token);
        var stderr = process.StandardError.ReadToEndAsync(timeout.Token);

        await process.WaitForExitAsync(timeout.Token);

        return ParseOutput(await stdout, await stderr, process.ExitCode);
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

    private static VaultCaptureResult ParseOutput(string stdout, string stderr, int exitCode)
    {
        var lastLine = stdout.Trim().Split('\n').LastOrDefault()?.Trim() ?? "";

        try
        {
            return JsonSerializer.Deserialize<VaultCaptureResult>(lastLine, Json) ?? throw new JsonException("empty result");
        }
        catch (JsonException)
        {
            var detail = (string.IsNullOrWhiteSpace(stderr) ? stdout : stderr).Trim();

            throw new InvalidOperationException($"VaultCapture exited with {exitCode}: {detail[..Math.Min(detail.Length, 500)]}");
        }
    }
}
