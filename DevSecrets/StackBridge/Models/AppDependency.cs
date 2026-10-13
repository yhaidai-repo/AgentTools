namespace DevSecrets.StackBridge.Models;

// An app that calls other apps: the apps it calls and, per call, the config keys that carry it.
public sealed record AppDependency(string App, DependencyCall[] Calls);
