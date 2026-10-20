namespace DevSecrets.DevHub.Models;

// POST /browser/type-secret: DevHub types a dev-secrets value into the element the MCP snapshot names (its ref, the
// MCP's `target`), so the value never passes through the agent. `Submit` presses Enter afterwards.
public sealed record TypeSecretRequest(string Element, string Target, string ValueName, bool? Submit);
