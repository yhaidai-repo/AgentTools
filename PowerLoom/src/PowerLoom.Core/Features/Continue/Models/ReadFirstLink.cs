namespace PowerLoom.Features.Continue.Models;

// A note the chat reads before anything else: its name (an Obsidian link), its path on the PC, what it is for.
public sealed record ReadFirstLink(string Name, string HostPath, string About);
