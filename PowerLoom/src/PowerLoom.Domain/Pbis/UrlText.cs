using System.Text.RegularExpressions;

namespace PowerLoom.Domain.Pbis;

public static partial class UrlText
{
    // Every distinct URL in a text, without trailing sentence punctuation.
    public static IReadOnlyList<string> ExtractUrls(string text)
    {
        return Url().Matches(text).Select(match => match.Value.TrimEnd('.', ',', ';', ':', '!', '?')).Distinct().ToList();
    }

    // The documents a PBI links from its description and acceptance criteria, each once.
    public static IReadOnlyList<string> PbiLinkedUrls(string? descriptionMd, string? acceptanceCriteriaMd)
    {
        return ExtractUrls($"{descriptionMd}\n{acceptanceCriteriaMd}").Select(LinkedDocuments.DocumentUrl).Distinct().ToList();
    }

    [GeneratedRegex("""https?://[^\s)\]>"'`]+""")]
    private static partial Regex Url();
}
