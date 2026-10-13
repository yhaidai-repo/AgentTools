namespace DevSecrets.StackBridge.Models;

// A project of map.json, the app it belongs to (null when no app lists it) and its settings.
public sealed record ProjectView(string Project, string? App, ProjectSetting[] Settings);
