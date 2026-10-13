namespace DevSecrets.DevHub.Models;

// Where calls to an app go in an environment (Azure dev): the named value a call reads ("patients-url"), the URL itself for
// a url (keys and users stay hidden), and the settings that use it.
public sealed record RemoteTarget(string Part, string ValueName, string? Url, string[] UsedBy);
