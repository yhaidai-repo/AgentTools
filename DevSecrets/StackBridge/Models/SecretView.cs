namespace DevSecrets.StackBridge.Models;

// A named value of a values file, without the value: its state (set, empty, placeholder), length and where it is used
// ("project: key").
public sealed record SecretView(string File, string Name, string State, int Length, string[] UsedBy);
