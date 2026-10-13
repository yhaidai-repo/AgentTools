using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DevSecrets.StackBridge.Config;

// Writes services.json and map.json the way they are kept in git: two-space JSON, LF, apps and projects sorted, every
// project's settings sorted case-insensitively; an app's own keys keep their order.
public static class StoreFileWriter
{
    public const string ServicesFile = "services.json";
    public const string MapFile = "map.json";

    private static readonly JsonSerializerOptions FileJson = new() { WriteIndented = true, NewLine = "\n", Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    public static void Write(string folder, JsonObject services, JsonObject map)
    {
        WriteFile(Path.Combine(folder, ServicesFile), SortedKeys(services, StringComparer.Ordinal));
        WriteFile(Path.Combine(folder, MapFile), SortedMap(map));
    }

    private static void WriteFile(string path, JsonObject content)
    {
        var temp = $"{path}.tmp";

        File.WriteAllText(temp, content.ToJsonString(FileJson) + "\n");
        File.Move(temp, path, overwrite: true);
    }

    private static JsonObject SortedMap(JsonObject map)
    {
        var projects = map["projects"]?.AsObject() ?? [];
        var sortedProjects = new JsonObject();

        foreach (var project in projects.OrderBy(project => project.Key, StringComparer.Ordinal))
            sortedProjects[project.Key] = SortedKeys(project.Value!.AsObject(), StringComparer.OrdinalIgnoreCase);

        return new JsonObject { ["projects"] = sortedProjects, ["repos"] = map["repos"]?.DeepClone() };
    }

    private static JsonObject SortedKeys(JsonObject node, StringComparer order)
    {
        var sorted = new JsonObject();

        foreach (var entry in node.OrderBy(entry => entry.Key, order))
            sorted[entry.Key] = entry.Value?.DeepClone();

        return sorted;
    }
}
