using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DevSecrets.DevHub.Config;

namespace DevSecrets.DevHub.Browser;

// The MCP's `--secrets` file: every dev-secrets value, so the MCP replaces any of them that shows up in a tool answer
// (a page that echoes a key, a typed password in the "ran code" block). Written per case next to nothing an agent
// reads, deleted when the case closes. Resolves one value by name for DevHub's own typing.
public sealed partial class SecretsFile(DevSecretsFiles files)
{
    private const string LocalValuesFile = "local";
    private const string RemoteValuesFile = "dev";
    private const int MinRedactedLength = 4;

    public string Write(string folder)
    {
        var path = Path.Combine(folder, "mcp-secrets.env");
        // Not the URLs (<app>-url, -url-2): an agent must see where a page is, and an address is no secret.
        var lines = AllValues().Where(pair => pair.Value.Length >= MinRedactedLength && !IsUrlValue(pair.Key)).Select(pair => $"{EnvName(pair.Key)}={pair.Value}");

        File.WriteAllText(path, string.Join("\n", lines) + "\n", new UTF8Encoding(false));

        return path;
    }

    public string? Resolve(string valueName)
    {
        var values = AllValues();

        return values.TryGetValue(valueName, out var value) ? value : null;
    }

    // The names an agent may use (never the values): for type-secret and http-request placeholders.
    public string[] Names() => AllValues().Keys.Order(StringComparer.Ordinal).ToArray();

    // Local values first (they extend dev), then dev.
    public Dictionary<string, string> AllValues()
    {
        var values = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (var file in new[] { RemoteValuesFile, LocalValuesFile })
            AddValues(values, files.ReadValues(file));

        return values;
    }

    private static void AddValues(Dictionary<string, string> values, JsonObject? json)
    {
        if (json is null)
            return;

        foreach (var (key, node) in json)
        {
            if (key != DevSecretsFiles.ExtendsKey && node is JsonValue value && value.TryGetValue<string>(out var text) && text.Length > 0)
                values[key] = text;
        }
    }

    private static string EnvName(string key) => NonEnvCharacters().Replace(key, "_").ToUpperInvariant();

    private static bool IsUrlValue(string key) => UrlValueName().IsMatch(key);

    [GeneratedRegex("[^A-Za-z0-9_]")]
    private static partial Regex NonEnvCharacters();

    [GeneratedRegex("-url(-[0-9]+)?$")]
    private static partial Regex UrlValueName();
}
