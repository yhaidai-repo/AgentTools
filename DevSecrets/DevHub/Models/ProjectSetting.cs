namespace DevSecrets.DevHub.Models;

// One config key of a project (map.json). A plain value: ValueName. A call to another app: Service and Part (url, key,
// user), local while that app runs locally, else RemoteValue (none = always the local one).
public sealed record ProjectSetting(string Key, string? ValueName, string? Service, string? Part, string? RemoteValue);
