namespace PowerLoom.Features.Continue.Models;

// One agent app a chat can open in: its launcher id and the name the buttons show.
public sealed record ChatApp(string Id, string Label);
