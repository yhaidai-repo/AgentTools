using DevSecrets.StackBridge.Models;

namespace DevSecrets.StackBridge.Config;

// What is wrong with the configuration. Errors come from the scripts themselves (Use-DevSecrets.ps1 -All -Check, once per
// values file), so the UI shows exactly what a start would refuse; warnings are the UI's own: loose ends that work.
public sealed class ConfigProblems(ScriptCheck check, DevSecretsFiles files, ConfigCatalog catalog)
{
    public async Task<IReadOnlyList<ConfigProblem>> FindAsync(CancellationToken cancellationToken)
    {
        var errors = new List<ConfigProblem>();

        foreach (var file in files.ValuesFileNames())
            errors.AddRange(await CheckAsync(file, cancellationToken));

        return [.. errors, .. Warnings()];
    }

    private async Task<IEnumerable<ConfigProblem>> CheckAsync(string valuesFile, CancellationToken cancellationToken)
    {
        var errors = await check.ErrorsAsync(valuesFile, null, cancellationToken);

        return errors.Select(error => new ConfigProblem("error", $"values.{valuesFile}.json", error));
    }

    private IEnumerable<ConfigProblem> Warnings()
    {
        var apps = catalog.GetApps();
        var appOfProject = catalog.AppOfProject();
        var projects = catalog.ReadProjects(appOfProject);

        return [.. UnusedValues(), .. ProjectsWithoutApp(projects), .. RunProjectsNotListed(apps)];
    }

    private IEnumerable<ConfigProblem> UnusedValues()
    {
        return catalog.GetSecrets()
            .SelectMany(file => file.Secrets)
            .Where(secret => secret.UsedBy.Length == 0)
            .Select(secret => new ConfigProblem("warning", $"values.{secret.File}.json", $"'{secret.Name}' is read by no project and no script"));
    }

    private static IEnumerable<ConfigProblem> ProjectsWithoutApp(IEnumerable<ProjectView> projects) =>
        projects.Where(project => project.App is null).Select(project => new ConfigProblem("warning", "map.json", $"{project.Project} belongs to no app in services.json: no stack starts or configures it"));

    private static IEnumerable<ConfigProblem> RunProjectsNotListed(IEnumerable<AppView> apps) =>
        apps.Where(app => app.Run?.Project is not null && !app.Projects.Contains(app.Run.Project))
            .Select(app => new ConfigProblem("warning", "services.json", $"{app.Name} starts {app.Run!.Project}, which is not in its projects: that project gets no configuration"));
}
