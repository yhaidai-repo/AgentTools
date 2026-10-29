namespace DevSecrets.DevHub.Models;

// Get-LocalStack.ps1 -Json.
public sealed record ScriptStackStatus(bool Running, string? Branch, string? Environment, ScriptServiceStatus[] Services, Dictionary<string, string>? BuildIdentity = null, bool StrictBranch = false)
{
    public static readonly ScriptStackStatus None = new(false, null, null, []);
}
