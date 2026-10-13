namespace DevSecrets.StackBridge.Models;

// Get-LocalStack.ps1 -Json.
public sealed record ScriptStackStatus(bool Running, string? Branch, ScriptServiceStatus[] Services)
{
    public static readonly ScriptStackStatus None = new(false, null, []);
}
