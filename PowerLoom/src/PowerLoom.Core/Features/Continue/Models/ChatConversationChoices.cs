using PowerLoom.Infrastructure.ChatLaunch.Models;

namespace PowerLoom.Features.Continue.Models;

public sealed record ChatConversationChoices(string Launcher, string Label, IReadOnlyList<DesktopConversation> Conversations);
