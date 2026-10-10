using System.Text.RegularExpressions;
using ReverseMarkdown;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// ADO's rich-text fields come as HTML; notes and agents read Markdown. Plain text passes through.
public static partial class HtmlMarkdown
{
    private static readonly Converter Converter = new(new Config
    {
        GithubFlavored = true,
        Formatting = { RemoveComments = true },
        Tags = { Unknown = Config.UnknownTagsOption.Bypass },
        Links = { SmartHref = true },
    });

    public static string Convert(string value)
    {
        var text = value.Trim();

        return HtmlTag().IsMatch(text) ? Converter.Convert(text).Trim() : text;
    }

    [GeneratedRegex("<[a-zA-Z/!][^>]*>")]
    private static partial Regex HtmlTag();
}
