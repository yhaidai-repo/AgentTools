namespace PowerLoom.Features.Continue.Models;

// One agent app a chat can open in: its launcher id, the name the buttons show, and whether it can be chosen (its
// provider is connected in Settings → AI providers).
public sealed record ChatApp(string Id, string Label, bool Connected);
