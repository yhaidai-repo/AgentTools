using System.Text.RegularExpressions;
using System.Web;

namespace PowerLoom.Domain.Pbis;

// Confluence Cloud page links: `/wiki/spaces/<space>/pages/<id>/<title>` or `…?pageId=<id>`. Short `/wiki/x/…` links
// can't be resolved without following them.
public static partial class ConfluencePageLinks
{
    public static string? PageId(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed))
            return null;

        var fromPath = PagePath().Match(parsed.AbsolutePath);

        return fromPath.Success ? fromPath.Groups[1].Value : HttpUtility.ParseQueryString(parsed.Query).Get("pageId");
    }

    // The site's base, e.g. https://approvedadmissions.atlassian.net.
    public static string Site(string url) => new Uri(url).GetLeftPart(UriPartial.Authority);

    // Why a link can't be listed as a Confluence page; null when it can.
    public static string? Problem(string url)
    {
        var isConfluence = Uri.TryCreate(url, UriKind.Absolute, out _) && LinkedDocuments.KindOf(url) == LinkedDocuments.Confluence;

        return isConfluence && PageId(url) is not null ? null : $"not a Confluence page link (…/wiki/spaces/<space>/pages/<id>/…): {url}";
    }

    // The title in a page link (`…/pages/<id>/Patient+Signal+-+X`), for pages added without one.
    public static string TitleFromUrl(string url)
    {
        var slug = new Uri(url).AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries).LastOrDefault() ?? "";

        return Digits().IsMatch(slug) ? "Confluence page" : SafeDecode(slug.Replace('+', ' '));
    }

    // A malformed %-escape in a pasted link shouldn't fail the save; the raw text is a good enough title then.
    private static string SafeDecode(string text)
    {
        try
        {
            return Uri.UnescapeDataString(text);
        }
        catch (UriFormatException)
        {
            return text;
        }
    }

    [GeneratedRegex(@"/wiki/spaces/[^/]+/pages/(\d+)")]
    private static partial Regex PagePath();

    [GeneratedRegex(@"^\d+$")]
    private static partial Regex Digits();
}
