namespace DevSecrets.DevHub.Models;

// One app another app calls, and the config keys ("project: key") that point at it.
public sealed record DependencyCall(string Service, string[] Keys);
