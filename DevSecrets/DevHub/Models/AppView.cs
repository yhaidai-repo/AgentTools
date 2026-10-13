namespace DevSecrets.DevHub.Models;

// One app of services.json as the UI shows it: where it answers on this PC ("<app>-url" of values.local.json) and where
// calls to it go in the environment (Remote).
public sealed record AppView(
    string Name,
    string? Note,
    string? LocalUrl,
    bool ConsumesBus,
    string[] Projects,
    AppRun? Run,
    RemoteTarget[] Remote
);
