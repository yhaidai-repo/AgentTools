namespace PowerLoom.Infrastructure.ChatLaunch.Models;

// What any chat launcher opens, provider neutral: the folder, the folders to attach, and the instructions.
public sealed record ChatRequest(string Title, IReadOnlyList<string> Intro, string Folder, IReadOnlyList<string> ExtraFolders, IReadOnlyList<string> Steps);
