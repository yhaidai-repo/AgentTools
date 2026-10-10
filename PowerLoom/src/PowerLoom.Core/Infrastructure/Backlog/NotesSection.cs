using System.Text.RegularExpressions;

namespace PowerLoom.Infrastructure.Backlog;

// `## Notes` is the only human-owned part of a rendered note; it must survive every re-render.
public static partial class NotesSection
{
    public const string Heading = "## Notes";

    public static string Of(string? existing)
    {
        var match = existing is null ? null : Line().Match(existing);

        if (match is null || !match.Success)
            return $"{Heading}\n";

        return existing![match.Index..].TrimEnd() + "\n";
    }

    // The body before the user's section (the template's own `## Notes` is replaced by it).
    public static string Before(string body)
    {
        var match = Line().Match(body);

        return match.Success ? body[..match.Index] : body;
    }

    [GeneratedRegex(@"^## Notes[ \t]*$", RegexOptions.Multiline)]
    private static partial Regex Line();
}
