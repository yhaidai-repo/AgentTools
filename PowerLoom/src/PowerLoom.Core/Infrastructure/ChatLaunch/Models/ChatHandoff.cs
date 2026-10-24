namespace PowerLoom.Infrastructure.ChatLaunch.Models;

// The note a chat follows: its path on the PC and its short version, which the launcher shows in the chat when its prompt
// takes it.
public sealed record ChatHandoff(string Path, string ShortVersion);
