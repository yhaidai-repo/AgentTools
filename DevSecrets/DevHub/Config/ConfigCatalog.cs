using System.Text.Json.Nodes;
using DevSecrets.DevHub.Models;

namespace DevSecrets.DevHub.Config;

// The UI's read-only view of the DevSecrets configuration: apps, who calls whom, every project's settings and the
// named values with where they are used. Values are never part of these answers; GetSecret reveals one on request.
public sealed class ConfigCatalog(DevSecretsFiles files)
{
    private const string Placeholder = "<fill-me>";

    // Values the scripts read themselves, not through map.json.
    private static readonly (string Value, string Reader)[] ScriptReads =
    [
        ("dev-hub-token", "Start-DevHub.ps1: DevHub token"),
        ("signals-servicebus", "LocalStack.RabbitMq.ps1: the shovel's Service Bus"),
        ("local-instance", "LocalStack.RabbitMq.ps1: the shovel's topic prefix"),
    ];

    public IReadOnlyList<AppView> GetApps() =>
        files.ReadServices().Select(service => ToAppView(service.Key, service.Value!.AsObject())).OrderBy(app => app.Name, StringComparer.Ordinal).ToList();

    public DependencyView GetDependencies()
    {
        var appOfProject = AppOfProject();
        var projects = ReadProjects(appOfProject);
        var apps = projects.Where(project => project.App is not null).GroupBy(project => project.App!).Select(ToDependency).Where(app => app.Calls.Length > 0);

        return new DependencyView(apps.OrderBy(app => app.App, StringComparer.Ordinal).ToArray(), projects);
    }

    public IReadOnlyList<SecretFileView> GetSecrets()
    {
        var usage = ValueUsage();

        return files.ValuesFileNames().Select(file => ToSecretFile(file, files.ReadValues(file)!, usage)).ToList();
    }

    public SecretValue? GetSecret(string file, string name)
    {
        var value = files.ReadValues(file)?[name];

        return value is null || name == DevSecretsFiles.ExtendsKey ? null : new SecretValue(file, name, value.ToString());
    }

    // Value name → who reads it: "project: key" settings (directly or as a reference's remote value) and the scripts.
    public Dictionary<string, List<string>> ValueUsage()
    {
        var usage = new Dictionary<string, List<string>>(StringComparer.Ordinal);

        foreach (var setting in ReadProjects(AppOfProject()).SelectMany(project => project.Settings.Select(setting => (project.Project, setting))))
            AddUsage(usage, setting.setting.ValueName ?? setting.setting.RemoteValue, $"{setting.Project}: {setting.setting.Key}");

        foreach (var read in ScriptReads)
            AddUsage(usage, read.Value, read.Reader);

        return usage;
    }

    public ProjectView[] ReadProjects(IReadOnlyDictionary<string, string> appOfProject)
    {
        var projects = files.ReadMap()["projects"]?.AsObject() ?? [];

        return projects
            .Select(project => new ProjectView(project.Key, appOfProject.GetValueOrDefault(project.Key), ToSettings(project.Value!.AsObject())))
            .OrderBy(project => project.Project, StringComparer.Ordinal)
            .ToArray();
    }

    // A project listed by two apps belongs to the first by name.
    public Dictionary<string, string> AppOfProject() =>
        GetApps()
            .SelectMany(app => app.Projects.Select(project => (Project: project, App: app.Name)))
            .DistinctBy(entry => entry.Project)
            .ToDictionary(entry => entry.Project, entry => entry.App, StringComparer.Ordinal);

    private static AppView ToAppView(string name, JsonObject service) =>
        new(
            name,
            Text(service, "note"),
            Text(service, "localUrl"),
            Text(service, "localKey"),
            Text(service, "localUser"),
            service["consumesBus"]?.GetValue<bool>() ?? false,
            service["projects"]?.AsArray().Select(project => project!.ToString()).ToArray() ?? [],
            service["run"] is JsonObject run ? ToRun(run) : null
        );

    private static AppRun ToRun(JsonObject run) =>
        new(
            Text(run, "kind"),
            Text(run, "project"),
            Text(run, "launchProfile"),
            Text(run, "readyLog"),
            Text(run, "readyProcess"),
            Text(run, "managementUrl"),
            run["requiresEnv"]?.AsObject().ToDictionary(variable => variable.Key, variable => variable.Value!.ToString()) ?? []
        );

    private static ProjectSetting[] ToSettings(JsonObject mapping) =>
        mapping.Select(setting => ToSetting(setting.Key, setting.Value!.ToString())).OrderBy(setting => setting.Key, StringComparer.Ordinal).ToArray();

    private static ProjectSetting ToSetting(string key, string value)
    {
        var reference = ServiceReference.Parse(value);

        if (reference is null)
            return new ProjectSetting(key, value, null, null, null);

        return new ProjectSetting(key, null, reference.Service, reference.Part, reference.Remote);
    }

    // An app's calls: the services its projects' references point at, other than itself (an own inbound key).
    private static AppDependency ToDependency(IGrouping<string, ProjectView> app)
    {
        var calls = app
            .SelectMany(project => project.Settings.Where(setting => setting.Service is not null && setting.Service != app.Key).Select(setting => (setting.Service!, $"{project.Project}: {setting.Key}")))
            .GroupBy(call => call.Item1)
            .Select(call => new DependencyCall(call.Key, call.Select(entry => entry.Item2).Order(StringComparer.Ordinal).ToArray()))
            .OrderBy(call => call.Service, StringComparer.Ordinal);

        return new AppDependency(app.Key, calls.ToArray());
    }

    private static SecretFileView ToSecretFile(string file, JsonObject values, Dictionary<string, List<string>> usage)
    {
        var secrets = values
            .Where(value => value.Key != DevSecretsFiles.ExtendsKey)
            .Select(value => ToSecret(file, value.Key, value.Value?.ToString() ?? "", usage))
            .OrderBy(secret => secret.Name, StringComparer.Ordinal);

        return new SecretFileView(file, Text(values, DevSecretsFiles.ExtendsKey), secrets.ToArray());
    }

    private static SecretView ToSecret(string file, string name, string value, Dictionary<string, List<string>> usage)
    {
        var state = value.Length == 0 ? "empty" : value == Placeholder ? "placeholder" : "set";

        return new SecretView(file, name, state, value.Length, usage.GetValueOrDefault(name)?.ToArray() ?? []);
    }

    private static void AddUsage(Dictionary<string, List<string>> usage, string? valueName, string setting)
    {
        if (valueName is null)
            return;

        if (!usage.TryGetValue(valueName, out var settings))
            usage[valueName] = settings = [];

        settings.Add(setting);
    }

    private static string? Text(JsonObject node, string property) => node[property] is JsonValue value ? value.ToString() : null;
}
