using System.Text.RegularExpressions;

namespace DevSecrets.StackBridge.Models;

// A map.json routing reference: "@patients.url|patients-remote-url" = the local URL of patients while it runs locally,
// else the named value; without "|remote" always the local one. The same pattern as DevSecrets.Resolve.ps1.
public sealed partial record ServiceReference(string Service, string Part, string? Remote)
{
    public static ServiceReference? Parse(string value)
    {
        var match = Pattern().Match(value);

        if (!match.Success)
            return null;

        var remote = match.Groups["remote"].Success ? match.Groups["remote"].Value : null;

        return new ServiceReference(match.Groups["service"].Value, match.Groups["part"].Value, remote);
    }

    [GeneratedRegex(@"^@(?<service>[a-z0-9-]+)\.(?<part>url|key|user)(\|(?<remote>.+))?$")]
    private static partial Regex Pattern();
}
