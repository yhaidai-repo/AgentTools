namespace DevSecrets.DevHub.Models;

// POST /browser: one browser case (a test case's walk through the apps) served by its own Playwright MCP process,
// recorded under <artifacts>/<owner>/<case>/. Owner: who opened it (PowerLoom passes its run); only the owner closes it.
public sealed record OpenBrowserRequest(string Owner, string Case, bool? Headless);
