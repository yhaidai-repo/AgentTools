using System.Text.Json.Nodes;
using DevSecrets.DevHub.Models;

namespace DevSecrets.DevHub.Config;

// Changes to a candidate map.json: projects and their settings.
public static class MapChanges
{
    public static JsonObject Projects(JsonObject map) => map["projects"]!.AsObject();

    public static bool HasProject(JsonObject map, string project) => Projects(map).ContainsKey(project);

    public static void AddProject(JsonObject map, string project)
    {
        if (!HasProject(map, project))
            Projects(map)[project] = new JsonObject();
    }

    public static void RemoveProject(JsonObject map, string project) => Projects(map).Remove(project);

    public static void SetSetting(JsonObject map, string project, string key, string value) => Projects(map)[project]![key] = value;

    public static bool RemoveSetting(JsonObject map, string project, string key) => Projects(map)[project]!.AsObject().Remove(key);

    // The map.json text of a setting: a value name, or "@service.part|remote".
    public static string SettingValue(SaveSettingRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Service))
            return request.ValueName!.Trim();

        var remote = string.IsNullOrWhiteSpace(request.RemoteValue) ? "" : $"|{request.RemoteValue.Trim()}";

        return $"@{request.Service.Trim()}.{request.Part!.Trim()}{remote}";
    }

    // "project: key" of every setting that calls this app.
    public static string[] ReferencesTo(JsonObject map, string app) =>
        Projects(map)
            .SelectMany(project => project.Value!.AsObject().Select(setting => (Project: project.Key, setting.Key, Value: setting.Value!.ToString())))
            .Where(setting => ServiceReference.Parse(setting.Value)?.Service == app)
            .Select(setting => $"{setting.Project}: {setting.Key}")
            .ToArray();
}
