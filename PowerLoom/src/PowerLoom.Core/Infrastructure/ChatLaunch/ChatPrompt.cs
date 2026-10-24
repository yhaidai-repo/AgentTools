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

    private static string Steps(ChatRequest request, string addFoldersSentence, string handoffStep)
    {
        var addFolders = request.ExtraFolders.Count > 0 ? [$"{addFoldersSentence}: {string.Join(", ", request.ExtraFolders)}."] : Array.Empty<string>();
        var steps = addFolders.Concat(request.Steps).Append(handoffStep).Select((step, index) => $"{index + 1}. {step}");

        return string.Join("\n", new[] { request.Title }.Concat(request.Intro).Concat(steps));
    }
}
