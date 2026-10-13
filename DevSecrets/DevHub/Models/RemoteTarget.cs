namespace DevSecrets.DevHub.Models;

// Where calls to an app go while it isn't local (Azure dev): the named value a reference falls back to
// ("@patients.url|patients-remote-url"), the URL itself for a url (keys and users stay hidden), and the settings that use it.
public sealed record RemoteTarget(string Part, string ValueName, string? Url, string[] UsedBy);
