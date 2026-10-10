using System.Text.Json;
using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Infrastructure.VaultScan;

// VaultUsage's log contract (its README): one JSON object per line in <vault>/.usage/usage.jsonl. Its PowerShell
// report isn't in the containers, so adoa reads the log itself.
public static class UsageLog
{
    private const string LogFile = ".usage/usage.jsonl";

    // Claude Code reads the vault mostly through shell commands (cat, sed, grep), logged as `shell` (user decision
    // 2026-10-02: they count, like in VaultUsage's own report). Writes alone don't.
    private static readonly string[] UseKinds = ["read", "search", "shell"];

    public static async Task<IReadOnlyList<VaultUsageEvent>> ReadAsync(string root, CancellationToken cancellation)
    {
        var file = Path.Combine(root, LogFile);

        if (!File.Exists(file))
            return [];

        var lines = await File.ReadAllLinesAsync(file, cancellation);

        return lines.Where(line => line.Trim().Length > 0).Select(ParseLine).Where(entry => entry is not null).Select(entry => entry!).ToList();
    }

    public static bool IsUse(VaultUsageEvent entry) => UseKinds.Contains(entry.Kind);

    private static VaultUsageEvent? ParseLine(string line)
    {
        try
        {
            using var document = JsonDocument.Parse(line);
            var root = document.RootElement;
            var at = Text(root, "ts");
            var file = Text(root, "file");
            var kind = Text(root, "kind");

            return at is null || file is null || kind is null || !DateTime.TryParse(at, null, System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var when)
                ? null
                : new VaultUsageEvent(when, file, kind, Text(root, "agent") ?? "unknown");
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string? Text(JsonElement element, string name) => element.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
}
