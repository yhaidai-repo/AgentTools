namespace DevSecrets.DevHub.Models;

// One service as Get-LocalStack.ps1 -Json reports it. Workers: the background workers the stack's config enabled
// (null for a service without a worker configuration).
public sealed record ScriptServiceStatus(string Name, bool Running, string? Url, string? Log, string? ErrorLog, string[]? Workers = null);
