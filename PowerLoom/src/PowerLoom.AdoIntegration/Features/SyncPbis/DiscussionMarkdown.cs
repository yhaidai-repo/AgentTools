using PowerLoom.AdoIntegration.Client.Models;
using PowerLoom.Infrastructure.Text;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// A work item's discussion as its note shows it: each comment under its author and day, quoted so that a heading inside a
// comment can't end the note's generated part (the user's `## Notes` section starts at such a line).
public static class DiscussionMarkdown
{
    public static string Render(IReadOnlyList<AdoComment> comments) => string.Join("\n\n", comments.Select(Comment));

    private static string Comment(AdoComment comment)
    {
        var day = comment.CreatedAt?.ToString("yyyy-MM-dd") ?? "unknown day";

        return $"### {comment.Author ?? "unknown"} · {day}\n\n{Quote(HtmlMarkdown.Convert(comment.TextHtml))}";
    }

    private static string Quote(string markdown)
    {
        var lines = markdown.ReplaceLineEndings("\n").Trim().Split('\n');

        return string.Join("\n", lines.Select(line => line.Length == 0 ? ">" : $"> {line}"));
    }
}
