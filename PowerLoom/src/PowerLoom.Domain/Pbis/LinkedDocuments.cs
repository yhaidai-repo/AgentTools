using System.Text.RegularExpressions;

namespace PowerLoom.Domain.Pbis;

// The kinds of documents a PBI links: Confluence pages (fetched with the Confluence token), ADO attachments (with the
// ADO token), and web pages (read by agents with web access, user decision 2026-10-14; otherwise the user attaches them).
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

    // A web page's `#…` anchor is a place in the same document (user decision 2026-10-14), so it is dropped; Confluence
    // pages keep theirs, as their stored pages are matched by the link as written.
    public static string DocumentUrl(string url) => KindOf(url) == Web ? url.Split('#')[0] : url;

    public static string Label(string kind) => kind switch { Confluence => "Confluence page", AdoAttachment => "ADO attachment", _ => "document" };

    [GeneratedRegex(@"atlassian\.net/wiki", RegexOptions.IgnoreCase)]
    private static partial Regex ConfluenceHost();

    [GeneratedRegex("_apis/wit/attachments", RegexOptions.IgnoreCase)]
    private static partial Regex AdoAttachmentPath();
}
