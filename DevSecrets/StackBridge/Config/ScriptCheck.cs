using System.Text.Json;
using DevSecrets.StackBridge.Models;

namespace DevSecrets.StackBridge.Config;

// Use-DevSecrets.ps1 -All -Check: the scripts' own validation of every project with one values file, on the real
// services.json and map.json or on a candidate copy (DEV_SECRETS_STORE_DIR).
public sealed class ScriptCheck(ScriptRunner runner)
{
    private const string CheckScript = "Use-DevSecrets.ps1";
    private const string StoreDirVariable = "DEV_SECRETS_STORE_DIR";

    private static readonly JsonSerializerOptions ScriptJson = new() { PropertyNameCaseInsensitive = true };

    public async Task<IReadOnlyList<string>> ErrorsAsync(string valuesFile, string? storeDir, CancellationToken cancellationToken)
    {
        var environment = storeDir is null ? null : new Dictionary<string, string> { [StoreDirVariable] = storeDir };
        var output = await runner.RunScriptAsync(CheckScript, ["-All", "-Check", "-Values", valuesFile], cancellationToken, environment);
        var text = string.Join('\n', output.Lines);

        if (output.ExitCode != 0)
            return [$"{CheckScript} -Check failed: {text}"];

        return JsonSerializer.Deserialize<CheckOutput>(text, ScriptJson)?.Problems ?? [];
    }
}
