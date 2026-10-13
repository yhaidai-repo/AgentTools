namespace DevSecrets.StackBridge.Models;

// PUT /config/apps/{name}: an app of services.json, added or changed. No Run: the app can't be started.
public sealed record SaveAppRequest(
    string? Note,
    string? LocalUrl,
    string? LocalKey,
    string? LocalUser,
    bool ConsumesBus,
    string[]? Projects,
    SaveRunRequest? Run
);
