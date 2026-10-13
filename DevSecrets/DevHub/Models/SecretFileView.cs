namespace DevSecrets.DevHub.Models;

// A values file (values.<name>.json) and its named values; Extends: the file whose values it overrides.
public sealed record SecretFileView(string File, string? Extends, SecretView[] Secrets);
