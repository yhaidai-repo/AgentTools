namespace PowerLoom.Features.Continue.Models;

// For every "Continue with <label>" button: the label, and why chats can't open (null when they can).
public sealed record LauncherAvailability(string Label, string? Problem);
