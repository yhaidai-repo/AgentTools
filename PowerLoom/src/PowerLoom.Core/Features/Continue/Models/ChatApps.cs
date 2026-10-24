namespace PowerLoom.Features.Continue.Models;

// The registered chat apps and the chosen one's id (Settings → AI providers).
public sealed record ChatApps(string Current, IReadOnlyList<ChatApp> Apps);
