namespace PowerLoom.Infrastructure.ChatLaunch.Models;

// How the user's machine opens the chat: a link its browser hands to the agent app (claude://, and later others).
public sealed record OpenedChat(string Url, string? ClipboardText = null);
