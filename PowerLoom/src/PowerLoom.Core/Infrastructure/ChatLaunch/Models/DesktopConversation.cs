namespace PowerLoom.Infrastructure.ChatLaunch.Models;

public sealed record DesktopConversation(string Id, string Title, string Folder, DateTimeOffset UpdatedAt, bool IsRelated = false);
