using System.Text.Json.Nodes;
using DevSecrets.StackBridge.Models;

namespace DevSecrets.StackBridge.Config;

// Changes to a candidate services.json. A new app's keys come in sorted order, like the file's; a changed app keeps the
// order of its keys, and run fields the form doesn't know stay.
public static class AppChanges
{
    public static void Apply(JsonObject services, string name, SaveAppRequest request)
    {
        var app = ChildObject(services, name);

        SetFlag(app, "consumesBus", request.ConsumesBus);
        SetText(app, "localKey", request.LocalKey);
        SetText(app, "localUrl", request.LocalUrl);
        SetText(app, "localUser", request.LocalUser);
        SetText(app, "note", request.Note);
        app["projects"] = new JsonArray([.. (request.Projects ?? []).Select(project => JsonValue.Create(project))]);
        ApplyRun(app, request.Run);
    }

    public static void Remove(JsonObject services, string name) => services.Remove(name);

    // The app whose projects list this project, if any.
    public static string? AppOf(JsonObject services, string project) =>
        services.FirstOrDefault(app => ProjectsOf(app.Value!.AsObject()).Contains(project)).Key;

    public static string[] ProjectsOf(JsonObject app) => app["projects"]?.AsArray().Select(project => project!.ToString()).ToArray() ?? [];

    // Lists the project under this app only.
    public static void MoveProject(JsonObject services, string project, string app)
    {
        foreach (var entry in services)
            RemoveProject(entry.Value!.AsObject(), project);

        services[app]!["projects"]!.AsArray().Add(JsonValue.Create(project));
    }

    public static void RemoveProject(JsonObject app, string project)
    {
        var projects = app["projects"]?.AsArray();
        var listed = projects?.FirstOrDefault(entry => entry!.ToString() == project);

        if (listed is not null)
            projects!.Remove(listed);
    }

    private static void ApplyRun(JsonObject app, SaveRunRequest? request)
    {
        if (request is null)
        {
            app.Remove("run");

            return;
        }

        var run = ChildObject(app, "run");

        SetText(run, "project", request.Project);
        SetText(run, "launchProfile", request.LaunchProfile);
        SetText(run, "readyLog", request.ReadyLog);
        SetText(run, "readyProcess", request.ReadyProcess);
        SetEnvironment(run, request.RequiresEnv);
    }

    // The existing object, or a new one added under the key (a node can't be assigned to the parent it already has).
    private static JsonObject ChildObject(JsonObject parent, string key)
    {
        if (parent[key] is JsonObject existing)
            return existing;

        var created = new JsonObject();

        parent[key] = created;

        return created;
    }

    private static void SetEnvironment(JsonObject run, Dictionary<string, string>? variables)
    {
        if (variables is not { Count: > 0 })
        {
            run.Remove("requiresEnv");

            return;
        }

        run["requiresEnv"] = new JsonObject(variables.Select(variable => KeyValuePair.Create(variable.Key, (JsonNode?) JsonValue.Create(variable.Value))));
    }

    // An empty field is no key: the scripts treat a missing key and an empty one alike, and the file stays short.
    private static void SetText(JsonObject node, string key, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            node.Remove(key);

            return;
        }

        node[key] = value.Trim();
    }

    // Only consumers carry the flag.
    private static void SetFlag(JsonObject node, string key, bool value)
    {
        if (!value)
        {
            node.Remove(key);

            return;
        }

        node[key] = true;
    }
}
