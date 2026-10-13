namespace DevSecrets.DevHub.Models;

// PUT /config/apps/{name}: an app of services.json, added or changed. No Run: the app can't be started. Its links (URL,
// key, user) are named values per environment ("<app>-url" in values.local.json, values.dev.json, …), edited as secrets.
public sealed record SaveAppRequest(
    string? Note,
    bool ConsumesBus,
    string[]? Projects,
    SaveRunRequest? Run
);
