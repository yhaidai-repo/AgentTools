namespace DevSecrets.StackBridge.Models;

// GET /config/dependencies: who calls whom, and every project's settings.
public sealed record DependencyView(AppDependency[] Apps, ProjectView[] Projects);
