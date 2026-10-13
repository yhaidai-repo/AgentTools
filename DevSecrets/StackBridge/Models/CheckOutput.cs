namespace DevSecrets.StackBridge.Models;

// Use-DevSecrets.ps1 -All -Check: the problems of every project with one values file.
public sealed record CheckOutput(string Values, string[] Problems);
