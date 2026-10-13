using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DevSecrets.StackBridge.Models;
using Microsoft.Extensions.Options;

namespace DevSecrets.StackBridge.Config;

// The UI's changes to services.json and map.json. Each change is made on a candidate copy, checked by the scripts
// (Use-DevSecrets.ps1 -Check on the copy, per values file) and written only when it adds no error the files didn't
// already have. Expected refusals are results.
public sealed partial class ConfigEditor(DevSecretsFiles files, ScriptCheck check, IOptions<StackBridgeOptions> options)
{
    private static readonly string[] Parts = ["url", "key", "user"];

    // One change at a time: a check takes seconds and works on the files as read at its start.
    private readonly SemaphoreSlim _gate = new(1, 1);

    public Task<BridgeResult> SaveAppAsync(string name, SaveAppRequest request, CancellationToken cancellationToken) =>
        ChangeAsync((services, map) => AppRefusal(name, request, map) ?? Applied(() => AppChanges.Apply(services, name, request)), cancellationToken);

    public Task<BridgeResult> DeleteAppAsync(string name, CancellationToken cancellationToken) =>
        ChangeAsync((services, map) => DeleteAppRefusal(services, map, name) ?? Applied(() => AppChanges.Remove(services, name)), cancellationToken);

    public Task<BridgeResult> SaveProjectAsync(SaveProjectRequest request, CancellationToken cancellationToken) =>
        ChangeAsync((services, map) => ProjectRefusal(services, map, request) ?? Applied(() => AddProject(services, map, request)), cancellationToken);

    public Task<BridgeResult> DeleteProjectAsync(string project, CancellationToken cancellationToken) =>
        ChangeAsync((services, map) => DeleteProjectRefusal(services, map, project) ?? Applied(() => RemoveProject(services, map, project)), cancellationToken);

    public Task<BridgeResult> SaveSettingAsync(SaveSettingRequest request, CancellationToken cancellationToken) =>
        ChangeAsync((services, map) => SettingRefusal(services, map, request) ?? Applied(() => MapChanges.SetSetting(map, request.Project, request.Key.Trim(), MapChanges.SettingValue(request))), cancellationToken);

    public Task<BridgeResult> DeleteSettingAsync(string project, string key, CancellationToken cancellationToken) =>
        ChangeAsync((_, map) => MapChanges.HasProject(map, project) && MapChanges.RemoveSetting(map, project, key) ? null : BridgeResult.NotFound($"{project} has no setting {key}."), cancellationToken);

    private async Task<BridgeResult> ChangeAsync(Func<JsonObject, JsonObject, BridgeResult?> change, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);

        try
        {
            return await ChangeLockedAsync(change, cancellationToken);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<BridgeResult> ChangeLockedAsync(Func<JsonObject, JsonObject, BridgeResult?> change, CancellationToken cancellationToken)
    {
        var services = files.ReadServices();
        var map = files.ReadMap();
        var refusal = change(services, map);

        if (refusal is not null)
            return refusal;

        var newErrors = await NewErrorsAsync(services, map, cancellationToken);

        if (newErrors.Count > 0)
            return BridgeResult.Conflict($"Not saved, the scripts would refuse it: {string.Join(" | ", newErrors)}");

        StoreFileWriter.Write(options.Value.ScriptsDir, services, map);

        return BridgeResult.Ok();
    }

    private async Task<IReadOnlyList<string>> NewErrorsAsync(JsonObject services, JsonObject map, CancellationToken cancellationToken)
    {
        var folder = Directory.CreateTempSubdirectory("devsecrets-check-").FullName;

        try
        {
            StoreFileWriter.Write(folder, services, map);

            return await NewErrorsInAsync(folder, cancellationToken);
        }
        finally
        {
            Directory.Delete(folder, recursive: true);
        }
    }

    private async Task<IReadOnlyList<string>> NewErrorsInAsync(string folder, CancellationToken cancellationToken)
    {
        var errors = new List<string>();

        foreach (var valuesFile in files.ValuesFileNames())
            errors.AddRange(await NewErrorsOfAsync(valuesFile, folder, cancellationToken));

        return errors;
    }

    // Errors the files already have don't block a change; the Problems tab lists them.
    private async Task<IEnumerable<string>> NewErrorsOfAsync(string valuesFile, string folder, CancellationToken cancellationToken)
    {
        var before = (await check.ErrorsAsync(valuesFile, null, cancellationToken)).ToHashSet(StringComparer.Ordinal);
        var after = await check.ErrorsAsync(valuesFile, folder, cancellationToken);

        return after.Where(error => !before.Contains(error)).Select(error => $"values.{valuesFile}.json: {error}");
    }

    private static BridgeResult? Applied(Action change)
    {
        change();

        return null;
    }

    private static void AddProject(JsonObject services, JsonObject map, SaveProjectRequest request)
    {
        MapChanges.AddProject(map, request.Project);
        AppChanges.MoveProject(services, request.Project, request.App);
    }

    private static void RemoveProject(JsonObject services, JsonObject map, string project)
    {
        MapChanges.RemoveProject(map, project);

        foreach (var app in services)
            AppChanges.RemoveProject(app.Value!.AsObject(), project);
    }

    private static BridgeResult? AppRefusal(string name, SaveAppRequest request, JsonObject map)
    {
        if (!KebabName().IsMatch(name))
            return BridgeResult.Invalid("An app name is lower-case letters and digits, joined by single '-' (e.g. pvs-web), at most 64 characters.");

        if (!string.IsNullOrWhiteSpace(request.LocalUrl) && !Uri.TryCreate(request.LocalUrl.Trim(), UriKind.Absolute, out _))
            return BridgeResult.Invalid($"Not an absolute URL: {request.LocalUrl}");

        var unknown = (request.Projects ?? []).Where(project => !MapChanges.HasProject(map, project)).ToArray();

        if (unknown.Length > 0)
            return BridgeResult.Invalid($"Not a project of map.json yet (add it under Dependencies first): {string.Join(", ", unknown)}");

        return RunRefusal(request);
    }

    // The started project must be one of the app's: only those get their settings.
    private static BridgeResult? RunRefusal(SaveAppRequest request)
    {
        var project = request.Run?.Project;

        if (string.IsNullOrWhiteSpace(project) || (request.Projects ?? []).Contains(project.Trim()))
            return null;

        return BridgeResult.Invalid($"The app starts {project}, which is not one of its projects.");
    }

    private static BridgeResult? DeleteAppRefusal(JsonObject services, JsonObject map, string name)
    {
        if (!services.ContainsKey(name))
            return BridgeResult.NotFound($"No app {name}.");

        var callers = MapChanges.ReferencesTo(map, name);

        return callers.Length > 0 ? BridgeResult.Conflict($"{name} is still called by: {string.Join("; ", callers)}. Change those settings first.") : null;
    }

    private static BridgeResult? ProjectRefusal(JsonObject services, JsonObject map, SaveProjectRequest request)
    {
        var repo = request.Project.Split('/', 2)[0];

        if (!ProjectPath().IsMatch(request.Project) || map["repos"]?[repo] is null)
            return BridgeResult.Invalid($"A project is \"<repo>/<path to .csproj>\" with a repo of map.json ({string.Join(", ", map["repos"]?.AsObject().Select(entry => entry.Key) ?? [])}).");

        return services.ContainsKey(request.App) ? null : BridgeResult.NotFound($"No app {request.App}.");
    }

    private static BridgeResult? DeleteProjectRefusal(JsonObject services, JsonObject map, string project)
    {
        if (!MapChanges.HasProject(map, project))
            return BridgeResult.NotFound($"No project {project}.");

        var starter = services.FirstOrDefault(app => app.Value?["run"]?["project"]?.ToString() == project).Key;

        return starter is null ? null : BridgeResult.Conflict($"{starter} starts {project}: change what it starts first.");
    }

    private static BridgeResult? SettingRefusal(JsonObject services, JsonObject map, SaveSettingRequest request)
    {
        if (!MapChanges.HasProject(map, request.Project))
            return BridgeResult.NotFound($"No project {request.Project}.");

        if (string.IsNullOrWhiteSpace(request.Key) || request.Key.Any(char.IsWhiteSpace))
            return BridgeResult.Invalid("A setting key is the .NET configuration key, e.g. ConnectionStrings:cache, without spaces.");

        return SourceRefusal(services, request);
    }

    // A setting reads either a named value or another app (whose name, part and remote value must make sense).
    private static BridgeResult? SourceRefusal(JsonObject services, SaveSettingRequest request)
    {
        var isCall = !string.IsNullOrWhiteSpace(request.Service);

        if (isCall == !string.IsNullOrWhiteSpace(request.ValueName))
            return BridgeResult.Invalid("Choose a named value or a call to an app, not both.");

        if (!isCall)
            return null;

        if (!services.ContainsKey(request.Service!.Trim()))
            return BridgeResult.NotFound($"No app {request.Service}.");

        return Parts.Contains(request.Part?.Trim()) ? null : BridgeResult.Invalid("A call reads the app's url, key or user.");
    }

    [GeneratedRegex("^(?=.{1,64}$)[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex KebabName();

    [GeneratedRegex(@"^[a-z0-9-]+/[^\s]+\.csproj$")]
    private static partial Regex ProjectPath();
}
