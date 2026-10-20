namespace DevSecrets.DevHub.Models;

// POST /browser: one browser case (a test case's walk through the apps), recorded as video + trace under
// <artifacts>/<owner>/<case>/. Owner: who opened it (PowerLoom passes its run); only the owner closes it.
public sealed record OpenBrowserRequest(string Owner, string Case, string? Url, bool? Headless);
