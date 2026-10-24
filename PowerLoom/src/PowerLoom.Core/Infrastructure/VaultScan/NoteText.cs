using System.Text.RegularExpressions;

namespace PowerLoom.Infrastructure.VaultScan;

public static partial class NoteText
{
    // The frontmatter's lines without the fences; empty when the note has none.
    public static string FrontmatterBlock(string text)
    {
        var match = Frontmatter().Match(text);

        return match.Success ? match.Groups[1].Value : "";
    }

    // The frontmatter `title`, else the first `# heading`; null when the note has neither.
    public static string? Title(string text)
    {
        var title = TitleField().Match(FrontmatterBlock(text));

        if (title.Success)
            return Unquoted(title.Groups[1].Value);

        var heading = Heading().Match(text);

        return heading.Success ? heading.Groups[1].Value : null;
    }

    // YAML quotes wrap the whole value; a title that only ends with a quote mark (`Rule "Active Hospice…"`) keeps it.
    private static string Unquoted(string value)
    {
        var isQuoted = value.Length > 1 && Quoted().IsMatch(value);

        return isQuoted ? value[1..^1] : value;
    }

    [GeneratedRegex(@"^---\r?\n([\s\S]*?)\r?\n---")]
    private static partial Regex Frontmatter();

    [GeneratedRegex(@"^title:\s*(.+?)\s*$", RegexOptions.Multiline)]
    private static partial Regex TitleField();

    [GeneratedRegex(@"^# (.+)$", RegexOptions.Multiline)]
    private static partial Regex Heading();

    [GeneratedRegex("""^(["']).*\1$""")]
    private static partial Regex Quoted();
}
