using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DevSecrets.DevHub.Models;
using Microsoft.Extensions.Options;

namespace DevSecrets.DevHub.Config;

// The UI's changes to services.json and map.json. Each change is made on a candidate copy, checked by the scripts
// (Use-DevSecrets.ps1 -Check on the copy, per values file) and written only when it adds no error the files didn't
// already have. Expected refusals are results.
public sealed partial class ConfigEditor(DevSecretsFiles files, ScriptCheck check, IOptions<DevHubOptions> options)
{
    private static readonly string[] Parts = ["url", "key", "user"];

    // One change at a time: a check takes seconds and works on the files as read at its start.
    private readonly SemaphoreSlim _gate = new(1, 1);

    public Task<HubResult> SaveAppAsync(string name, SaveAppRequest request, CancellationToken cancellationToken) =>
        ChangeAsync((services, map) => AppRefusal(name, request, map) ?? Applied(() => AppChanges.Apply(services, name, request)), cancellationToken);

    public Task<HubResult> DeleteAppAsync(string name, CancellationToken cancellationToken) =>
        ChangeAsync((services, map) => DeleteAppRefusal(services, map, name) ?? Applied(() => AppChanges.Remove(services, name)), cancellationToken);

    public Task<HubResult> SaveProjectAsync(SaveProjectRequest request, CancellationToken cancellationToken) =>
        ChangeAsync((services, map) => ProjectRefusal(services, map, request) ?? Applied(() => AddProject(services, map, request)), cancellationToken);

    public Task<HubResult> DeleteProjectAsync(string project, CancellationToken cancellationToken) =>
        ChangeAsync((services, map) => DeleteProjectRefusal(services, map, project) ?? Applied(() => RemoveProject(services, map, project)), cancellationToken);

    public Task<HubResult> SaveSettingAsync(SaveSettingRequest request, CancellationToken cancellationToken) =>
        ChangeAsync((services, map) => SettingRefusal(services, map, request) ?? Applied(() => MapChanges.SetSetting(map, request.Project, request.Key.Trim(), MapChanges.SettingValue(request))), cancellationToken);

    public Task<HubResult> DeleteSettingAsync(string project, string key, CancellationToken cancellationToken) =>
        ChangeAsync((_, map) => MapChanges.HasProject(map, project) && MapChanges.RemoveSetting(map, project, key) ? null : HubResult.NotFound($"{project} has no setting {key}."), cancellationToken);

    private async Task<HubResult> ChangeAsync(Func<JsonObject, JsonObject, HubResult?> change, CancellationToken cancellationToken)
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

    private async Task<HubResult> ChangeLockedAsync(Func<JsonObject, JsonObject, HubResult?> change, CancellationToken cancellationToken)
    {
        var services = files.ReadServices();
        var map = files.ReadMap();
        var refusal = change(services, map);

        if (refusal is not null)
            return refusal;

        var newErrors = await NewErrorsAsync(services, map, cancellationToken);

        if (newErrors.Count > 0)
            return HubResult.Conflict($"Not saved, the scripts would refuse it: {string.Join(" | ", newErrors)}");

        StoreFileWriter.Write(options.Value.ScriptsDir, services, map);

        return HubResult.Ok();
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

    private static HubResult? Applied(Action change)
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

    private static HubResult? AppRefusal(string name, SaveAppRequest request, JsonObject map)
    {
        if (!KebabName().IsMatch(name))
            return HubResult.Invalid("An app name is lower-case letters and digits, joined by single '-' (e.g. pvs-web), at most 64 characters.");

        var unknown = (request.Projects ?? []).Where(project => !MapChanges.HasProject(map, project)).ToArray();

        if (unknown.Length > 0)
            return HubResult.Invalid($"Not a project of map.json yet (add it under Dependencies first): {string.Join(", ", unknown)}");

        return RunRefusal(request);
    }

    // The started project must be one of the app's: only those get their settings.
    private static HubResult? RunRefusal(SaveAppRequest request)
    {
        var project = request.Run?.Project;

        if (string.IsNullOrWhiteSpace(project) || (request.Projects ?? []).Contains(project.Trim()))
            return null;

        return HubResult.Invalid($"The app starts {project}, which is not one of its projects.");
    }

    private static HubResult? DeleteAppRefusal(JsonObject services, JsonObject map, string name)
    {
        if (!services.ContainsKey(name))
            return HubResult.NotFound($"No app {name}.");

        var callers = MapChanges.ReferencesTo(map, name);

        return callers.Length > 0 ? HubResult.Conflict($"{name} is still called by: {string.Join("; ", callers)}. Change those settings first.") : null;
    }

    private static HubResult? ProjectRefusal(JsonObject services, JsonObject map, SaveProjectRequest request)
    {
        var repo = request.Project.Split('/', 2)[0];

        if (!ProjectPath().IsMatch(request.Project) || map["repos"]?[repo] is null)
            return HubResult.Invalid($"A project is \"<repo>/<path to .csproj>\" with a repo of map.json ({string.Join(", ", map["repos"]?.AsObject().Select(entry => entry.Key) ?? [])}).");

        return services.ContainsKey(request.App) ? null : HubResult.NotFound($"No app {request.App}.");
    }

    private static HubResult? DeleteProjectRefusal(JsonObject services, JsonObject map, string project)
    {
        if (!MapChanges.HasProject(map, project))
            return HubResult.NotFound($"No project {project}.");

        var starter = services.FirstOrDefault(app => app.Value?["run"]?["project"]?.ToString() == project).Key;

        return starter is null ? null : HubResult.Conflict($"{starter} starts {project}: change what it starts first.");
    }

    private static HubResult? SettingRefusal(JsonObject services, JsonObject map, SaveSettingRequest request)
    {
        if (!MapChanges.HasProject(map, request.Project))
            return HubResult.NotFound($"No project {request.Project}.");

        if (string.IsNullOrWhiteSpace(request.Key) || request.Key.Any(char.IsWhiteSpace))
            return HubResult.Invalid("A setting key is the .NET configuration key, e.g. ConnectionStrings:cache, without spaces.");

        return SourceRefusal(services, request);
    }

    // A setting reads either a named value or another app (whose name, part and remote value must make sense).
    private static HubResult? SourceRefusal(JsonObject services, SaveSettingRequest request)
    {
        var isCall = !string.IsNullOrWhiteSpace(request.Service);

        if (isCall == !string.IsNullOrWhiteSpace(request.ValueName))
            return HubResult.Invalid("Choose a named value or a call to an app, not both.");

        if (!isCall)
            return null;

        if (!services.ContainsKey(request.Service!.Trim()))
            return HubResult.NotFound($"No app {request.Service}.");

        if (request.Instance is < 1)
            return HubResult.Invalid("An instance is 1 (the app's first address) or more.");

        return Parts.Contains(request.Part?.Trim()) ? null : HubResult.Invalid("A call reads the app's url, key or user.");
    }

    [GeneratedRegex("^(?=.{1,64}$)[a-z0-9]+(-[a-z0-9]+)*$")]
    private static partial Regex KebabName();

    [GeneratedRegex(@"^[a-z0-9-]+/[^\s]+\.csproj$")]
    private static partial Regex ProjectPath();
}
