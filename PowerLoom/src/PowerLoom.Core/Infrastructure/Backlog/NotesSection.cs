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

        return RepeatedHeadings().Replace(existing![match.Index..], "", 1).TrimEnd() + "\n";
    }

    // The user's text under the heading, as the PBI page edits it.
    public static string BodyOf(string? existing) => Clean(Of(existing)[Heading.Length..]);

    // The note with the user's section holding this text instead.
    public static string Replace(string note, string body)
    {
        var text = Clean(body);
        var section = text.Length == 0 ? $"{Heading}\n" : $"{Heading}\n\n{text}\n";

        return $"{Before(note).TrimEnd()}\n\n{section}";
    }

    // Line endings differ between the browser (CRLF) and the vault (LF); surrounding blank lines don't count.
    public static string Clean(string text) => text.ReplaceLineEndings("\n").Trim();

    // The body before the user's section (the template's own `## Notes` is replaced by it).
    public static string Before(string body)
    {
        var match = Line().Match(body);

        return match.Success ? body[..match.Index] : body;
    }

    // A heading line, also with a Windows line ending: a template saved on Windows mustn't hide its heading (each render
    // then kept the template's `## Notes` above the user's section, one more per render).
    [GeneratedRegex(@"^## Notes[ \t]*\r?$", RegexOptions.Multiline)]
    private static partial Regex Line();

    // Empty `## Notes` headings stacked above the last one (notes that bug left behind): one heading stays.
    [GeneratedRegex(@"\A(?:## Notes[ \t]*\r?\n\s*)+(?=## Notes[ \t]*\r?(?:\n|\z))")]
    private static partial Regex RepeatedHeadings();
}
