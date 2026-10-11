using System.Text.RegularExpressions;

namespace PowerLoom.Domain.Pbis;

// The kinds of documents a PBI links: Confluence pages (fetched with the Confluence token), ADO attachments (with the
// ADO token), and web pages (the user attaches them).
public static partial class LinkedDocuments
{
    public const string Confluence = "confluence";
    public const string AdoAttachment = "ado-attachment";
    public const string Web = "web";

    public static string KindOf(string url)
    {
        if (ConfluenceHost().IsMatch(url))
            return Confluence;

        return AdoAttachmentPath().IsMatch(url) ? AdoAttachment : Web;
    }

    public static string Label(string kind) => kind switch { Confluence => "Confluence page", AdoAttachment => "ADO attachment", _ => "document" };

    [GeneratedRegex(@"atlassian\.net/wiki", RegexOptions.IgnoreCase)]
    private static partial Regex ConfluenceHost();

    [GeneratedRegex("_apis/wit/attachments", RegexOptions.IgnoreCase)]
    private static partial Regex AdoAttachmentPath();
}
