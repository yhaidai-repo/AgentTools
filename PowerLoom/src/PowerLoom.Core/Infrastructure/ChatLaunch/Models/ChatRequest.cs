namespace PowerLoom.Infrastructure.ChatLaunch.Models;

// What any chat launcher opens, provider neutral: the folder, the folders to attach, the instructions, and the handoff
// note the chat follows.
public sealed record ChatRequest(string Title, IReadOnlyList<string> Intro, string Folder, IReadOnlyList<string> ExtraFolders, IReadOnlyList<string> Steps, ChatHandoff Handoff, ChatDestination? Destination = null);
