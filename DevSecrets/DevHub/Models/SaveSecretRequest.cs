namespace DevSecrets.DevHub.Models;

// PUT /config/secrets/{file}/{name}: the new value (added, or replacing the old one).
public sealed record SaveSecretRequest(string? Value);
