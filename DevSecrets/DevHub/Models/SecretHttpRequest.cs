namespace DevSecrets.DevHub.Models;

// POST /browser/http-request: DevHub sends an HTTP request on the host with `{{secret:<value name>}}` placeholders in
// the URL, headers and body replaced by dev-secrets values, so an API key never passes through the agent.
public sealed record SecretHttpRequest(string Method, string Url, Dictionary<string, string>? Headers, string? Body, string? ContentType);
