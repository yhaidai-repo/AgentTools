namespace DevSecrets.DevHub.Models;

// POST /browser/act. The target is one of: role + name (as the snapshot shows them), label, text, placeholder or a
// CSS selector. `Value` is typed as given; `ValueName` names a dev-secrets value DevHub types instead, so a password
// never passes through the agent.
public sealed record BrowserAction(
    BrowserActionKind Action,
    string? Url = null,
    string? Role = null,
    string? Name = null,
    string? Label = null,
    string? Text = null,
    string? Placeholder = null,
    string? Selector = null,
    bool? Exact = null,
    string? Value = null,
    string? ValueName = null,
    string? Key = null
);
