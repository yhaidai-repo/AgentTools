using System.Text.RegularExpressions;
using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Infrastructure.VaultScan;

// [[name]], [[name|label]], [[name#heading]], ![[embed]]. Links in fenced code and inline code are examples (e.g.
// AGENTS.md's templates), not links.
public static partial class WikiLinks
{
    public static IReadOnlyList<WikiLink> Parse(string from, string content)
    {
        var lines = content.Split('\n');
        var links = new List<WikiLink>();
        var inFence = false;

        for (var index = 0; index < lines.Length; index++)
            inFence = CollectLine(from, lines[index], index + 1, inFence, links);

        return links;
    }

    // How Obsidian compares link targets: case-insensitive, `.md` optional, `/` separators.
    public static string LinkKey(string target) => MarkdownExtension().Replace(target.Trim().Replace('\\', '/'), "").ToLowerInvariant();

    private static bool CollectLine(string from, string line, int number, bool inFence, List<WikiLink> links)
    {
        if (Fence().IsMatch(line))
            return !inFence;

        if (inFence)
            return true;

        links.AddRange(ProseSegments(line).SelectMany(segment => Link().Matches(segment)).Where(match => match.Groups[2].Value.Trim().Length > 0).Select(match => ToLink(from, match, number, line)));

        return false;
    }

    // The parts of a line outside inline code (the capture group keeps the code spans at the odd indexes).
    private static IEnumerable<string> ProseSegments(string line) => InlineCode().Split(line).Where((_, index) => index % 2 == 0);

    private static WikiLink ToLink(string from, Match match, int line, string lineText)
    {
        var heading = match.Groups[3].Success ? match.Groups[3].Value[1..] : null;
        var label = match.Groups[4].Success ? match.Groups[4].Value[1..] : null;
        var text = lineText.Trim();

        return new WikiLink(from, match.Groups[2].Value.Trim(), heading, label, line, text[..Math.Min(text.Length, 300)]);
    }

    [GeneratedRegex(@"(!?)\[\[([^\]|#]*)(#[^\]|]*)?(\|[^\]]*)?\]\]")]
    private static partial Regex Link();

    [GeneratedRegex(@"^\s*(```|~~~)")]
    private static partial Regex Fence();

    [GeneratedRegex("(`[^`]*`)")]
    private static partial Regex InlineCode();

    [GeneratedRegex(@"\.md$", RegexOptions.IgnoreCase)]
    private static partial Regex MarkdownExtension();
}
