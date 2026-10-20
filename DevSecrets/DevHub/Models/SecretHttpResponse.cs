namespace DevSecrets.DevHub.Models;

// The answer of a host-side HTTP request: status, the headers worth reading and the body (secrets redacted, cut).
public sealed record SecretHttpResponse(int Status, Dictionary<string, string> Headers, string Body, bool BodyCut);
