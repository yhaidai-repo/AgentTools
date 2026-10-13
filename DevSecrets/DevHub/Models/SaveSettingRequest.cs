namespace DevSecrets.DevHub.Models;

// PUT /config/settings: one config key of a project, from a named value, or a call to another app (Service and Part;
// Instance 2, 3, … for an app with several addresses, e.g. VAPI's second instance "vapi-url-2").
public sealed record SaveSettingRequest(string Project, string Key, string? ValueName, string? Service, string? Part, int? Instance);
