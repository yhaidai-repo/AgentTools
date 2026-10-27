using PowerLoom.Infrastructure.ChatLaunch.Models;

namespace PowerLoom.Infrastructure.ChatLaunch;

public static class ChatPrompt
{
    public static string Build(ChatRequest request, string addFoldersSentence, int maxLength)
    {
        var shown = $"{Steps(request, addFoldersSentence, $"Read {request.Handoff.Path} and follow its Start section. Its short version, for you and me:")}\n\n---\n\n{request.Handoff.ShortVersion}";

        return shown.Length <= maxLength
            ? shown
            : Steps(request, addFoldersSentence, $"Read {request.Handoff.Path} and follow its Start section.");
    }

    // The vault comes first, said in words too: a chat app may open the session elsewhere (Claude desktop makes a folder
    // of its own when the link's folder isn't applied), and without the vault the chat knows none of its rules.
    private static string Steps(ChatRequest request, string addFoldersSentence, string handoffStep)
    {
        var vault = $"Work in the vault {request.Folder}: if it isn't this session's working folder, add it to the session. Read its AGENTS.md and follow it.";
        var addFolders = request.ExtraFolders.Count > 0 ? [$"{addFoldersSentence}: {string.Join(", ", request.ExtraFolders)}."] : Array.Empty<string>();
        var steps = addFolders.Prepend(vault).Concat(request.Steps).Append(handoffStep).Select((step, index) => $"{index + 1}. {step}");

        return string.Join("\n", new[] { request.Title }.Concat(request.Intro).Concat(steps));
    }
}
