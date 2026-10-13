namespace DevSecrets.DevHub.Models;

// PUT /config/settings: one config key of a project, from a named value, or a call to another app (Service and Part;
// RemoteValue is used while that app isn't local, none = always the local one).
public sealed record SaveSettingRequest(string Project, string Key, string? ValueName, string? Service, string? Part, string? RemoteValue);
