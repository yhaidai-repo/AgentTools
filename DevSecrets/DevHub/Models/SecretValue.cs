namespace DevSecrets.DevHub.Models;

// GET /config/secrets/{file}/{name}: one value, revealed on request.
public sealed record SecretValue(string File, string Name, string Value);
