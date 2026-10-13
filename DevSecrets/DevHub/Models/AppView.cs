namespace DevSecrets.DevHub.Models;

// One app of services.json as the UI shows it, with where calls to it go while it isn't local.
public sealed record AppView(
    string Name,
    string? Note,
    string? LocalUrl,
    string? LocalKey,
    string? LocalUser,
    bool ConsumesBus,
    string[] Projects,
    AppRun? Run,
    RemoteTarget[] Remote
);
