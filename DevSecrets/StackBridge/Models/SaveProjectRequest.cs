namespace DevSecrets.StackBridge.Models;

// PUT /config/projects: a project of map.json ("<repo>/<path to csproj>") and the app it belongs to.
public sealed record SaveProjectRequest(string Project, string App);
