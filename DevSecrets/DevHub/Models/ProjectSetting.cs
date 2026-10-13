namespace DevSecrets.DevHub.Models;

// One config key of a project (map.json). A plain value: ValueName. A call to another app: Service and Part (url, key,
// user), read from the named value Endpoint ("patients-url") of values.local.json while that app runs in the stack,
// else of the stack's environment.
public sealed record ProjectSetting(string Key, string? ValueName, string? Service, string? Part, string? Endpoint);
