using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DevSecrets.DevHub.Models;
using Microsoft.Extensions.Options;

namespace DevSecrets.DevHub.Config;

// The DevSecrets files, read fresh on every call: services.json and map.json next to the scripts (in git), the named
// values in values.<name>.json (outside git).
public sealed partial class DevSecretsFiles(IOptions<DevHubOptions> options)
{
    public const string ExtendsKey = "$extends";

    public JsonObject ReadServices() => ReadObject(Path.Combine(options.Value.ScriptsDir, "services.json"));

    public JsonObject ReadMap() => ReadObject(Path.Combine(options.Value.ScriptsDir, "map.json"));

    // "remote", "local", … from values.<name>.json.
    public string[] ValuesFileNames()
    {
        return Directory.GetFiles(options.Value.ValuesDir, "values.*.json")
            .Select(path => Path.GetFileName(path)["values.".Length..^".json".Length])
            .Where(IsValuesFileName)
            .Order(StringComparer.Ordinal)
            .ToArray();
    }

    public JsonObject? ReadValues(string file)
    {
        var path = Path.Combine(options.Value.ValuesDir, $"values.{file}.json");

        return IsValuesFileName(file) && File.Exists(path) ? ReadObject(path) : null;
    }

    // Guards the file name against paths: it comes from the URL.
    public static bool IsValuesFileName(string file) => ValuesFileName().IsMatch(file);

    private static JsonObject ReadObject(string path) => JsonNode.Parse(File.ReadAllText(path))?.AsObject() ?? [];

    [GeneratedRegex("^[a-z0-9-]+$")]
    private static partial Regex ValuesFileName();
}
