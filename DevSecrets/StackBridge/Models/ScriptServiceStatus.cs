namespace DevSecrets.StackBridge.Models;

// One service of Get-LocalStack.ps1 -Json.
public sealed record ScriptServiceStatus(string Name, bool Running, string? Url, string? Log, string? ErrorLog);
