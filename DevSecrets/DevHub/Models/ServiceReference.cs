using System.Text.RegularExpressions;

namespace DevSecrets.DevHub.Models;

// A map.json call to an app: "@patients.url" reads the named value "patients-url", "@vapi.url-2" reads "vapi-url-2"
// (Endpoint), from values.local.json while the app runs in the stack, else from the stack's environment. The same
// pattern as DevSecrets.Resolve.ps1.
public sealed partial record ServiceReference(string Service, string Part, string Instance)
{
    public string Endpoint => $"{Service}-{Part}{Instance}";

    public static ServiceReference? Parse(string value)
    {
        var match = Pattern().Match(value);

        if (!match.Success)
            return null;

        return new ServiceReference(match.Groups["service"].Value, match.Groups["part"].Value, match.Groups["instance"].Value);
    }

    [GeneratedRegex(@"^@(?<service>[a-z0-9-]+)\.(?<part>url|key|user)(?<instance>-[0-9]+)?$")]
    private static partial Regex Pattern();
}
