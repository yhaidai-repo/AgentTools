using DevSecrets.StackBridge.Models;

namespace DevSecrets.StackBridge.Config;

// The configuration UI's data and changes: apps, dependencies (projects and their settings), secrets (values only on
// request) and problems. Changes to apps and dependencies are checked by the scripts before they are written.
public static class ConfigEndpoints
{
    private const string ConfigPath = "/config";

    public static WebApplication MapConfigEndpoints(this WebApplication app)
    {
        app.MapGet($"{ConfigPath}/apps", (ConfigCatalog catalog) => TypedResults.Ok(catalog.GetApps()));
        app.MapGet($"{ConfigPath}/dependencies", (ConfigCatalog catalog) => TypedResults.Ok(catalog.GetDependencies()));
        app.MapGet($"{ConfigPath}/secrets", (ConfigCatalog catalog) => TypedResults.Ok(catalog.GetSecrets()));
        app.MapGet($"{ConfigPath}/secrets/{{file}}/{{name}}", RevealSecret);
        app.MapPut($"{ConfigPath}/secrets/{{file}}/{{name}}", (string file, string name, SaveSecretRequest request, SecretEditor editor) => ToHttp(editor.Save(file, name, request.Value)));
        app.MapDelete($"{ConfigPath}/secrets/{{file}}/{{name}}", (string file, string name, SecretEditor editor) => ToHttp(editor.Delete(file, name)));
        app.MapGet($"{ConfigPath}/problems", (ConfigProblems problems, CancellationToken cancellationToken) => problems.FindAsync(cancellationToken));
        app.MapPut($"{ConfigPath}/apps/{{name}}", async (string name, SaveAppRequest request, ConfigEditor editor, CancellationToken cancellationToken) => ToHttp(await editor.SaveAppAsync(name, request, cancellationToken)));
        app.MapDelete($"{ConfigPath}/apps/{{name}}", async (string name, ConfigEditor editor, CancellationToken cancellationToken) => ToHttp(await editor.DeleteAppAsync(name, cancellationToken)));
        app.MapPut($"{ConfigPath}/projects", async (SaveProjectRequest request, ConfigEditor editor, CancellationToken cancellationToken) => ToHttp(await editor.SaveProjectAsync(request, cancellationToken)));
        app.MapDelete($"{ConfigPath}/projects", async (string project, ConfigEditor editor, CancellationToken cancellationToken) => ToHttp(await editor.DeleteProjectAsync(project, cancellationToken)));
        app.MapPut($"{ConfigPath}/settings", async (SaveSettingRequest request, ConfigEditor editor, CancellationToken cancellationToken) => ToHttp(await editor.SaveSettingAsync(request, cancellationToken)));
        app.MapDelete($"{ConfigPath}/settings", async (string project, string key, ConfigEditor editor, CancellationToken cancellationToken) => ToHttp(await editor.DeleteSettingAsync(project, key, cancellationToken)));

        return app;
    }

    private static IResult ToHttp(BridgeResult result) =>
        result.IsSuccess ? TypedResults.Ok() : TypedResults.Problem(result.Error, statusCode: result.StatusCode);

    private static IResult RevealSecret(string file, string name, ConfigCatalog catalog)
    {
        var secret = catalog.GetSecret(file, name);

        if (secret is null)
            return TypedResults.Problem($"No value '{name}' in values.{file}.json.", statusCode: StatusCodes.Status404NotFound);

        return TypedResults.Ok(secret);
    }
}
