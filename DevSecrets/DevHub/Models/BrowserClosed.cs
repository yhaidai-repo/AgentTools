namespace DevSecrets.DevHub.Models;

// DELETE /browser: the closed case and the files it left on the host (video, trace).
public sealed record BrowserClosed(string Case, string[] Artifacts);
