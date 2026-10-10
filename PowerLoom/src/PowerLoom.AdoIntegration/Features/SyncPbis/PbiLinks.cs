using System.Text.RegularExpressions;
using System.Web;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Domain.Pbis;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// The PBIs an imported item links: only work item links of the configured org and project count. Bare numbers don't,
// because mails mention other ids too (e.g. "[587484]" is a Freshdesk ticket).
public static partial class PbiLinks
{
    // Its id (123, #123), a link to it in Azure DevOps (…/_workitems/edit/123, …/workitems/123, ?id=123) or in adoa
    // (/pbis/123).
    private static readonly Regex[] References = [new(@"^#?(\d+)$"), new(@"workitems/(?:edit/)?(\d+)", RegexOptions.IgnoreCase), new(@"/pbis/(\d+)"), new(@"[?&]id=(\d+)")];

    public static IReadOnlyList<int> Extract(AdoSettings ado, string? html, string? text)
    {
        var urls = UrlText.ExtractUrls($"{DecodeAmpersands(html ?? "")}\n{text}").Select(UnwrapSafeLink);
        var bases = ProjectBaseUrls(ado);

        return urls.Where(url => IsProjectWorkItemUrl(bases, url)).Select(ParseReference).Where(id => id is not null).Select(id => id!.Value).Distinct().ToList();
    }

    // A PBI as the user types it.
    public static int? ParseReference(string text)
    {
        var value = text.Trim();
        var match = References.Select(pattern => pattern.Match(value)).FirstOrDefault(match => match.Success);

        return match is null ? null : int.Parse(match.Groups[1].Value);
    }

    private static string DecodeAmpersands(string html) => html.Replace("&amp;", "&", StringComparison.OrdinalIgnoreCase);

    // Outlook (Defender Safe Links) wraps every link in a mail: …safelinks.protection.outlook.com/?url=<encoded link>&…
    private static string UnwrapSafeLink(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed) || !SafeLinksHost().IsMatch(parsed.Host))
            return url;

        return HttpUtility.ParseQueryString(parsed.Query).Get("url") ?? url;
    }

    // dev.azure.com/<org>/<project>/… or the older <org>.visualstudio.com/<project>/…
    private static bool IsProjectWorkItemUrl(IReadOnlyList<string> bases, string url)
    {
        return bases.Any(projectBase => url.StartsWith(projectBase, StringComparison.OrdinalIgnoreCase)) && WorkItemsPath().IsMatch(url);
    }

    private static List<string> ProjectBaseUrls(AdoSettings ado)
    {
        var orgUrl = ado.OrgUrl.TrimEnd('/').ToLowerInvariant();
        var org = orgUrl.Split('/').Last();
        string[] projects = [ado.Project.ToLowerInvariant(), Uri.EscapeDataString(ado.Project).ToLowerInvariant()];
        string[] orgBases = [orgUrl, $"https://{org}.visualstudio.com"];

        return orgBases.SelectMany(orgBase => projects.Select(project => $"{orgBase}/{project}/")).ToList();
    }

    [GeneratedRegex(@"\.safelinks\.protection\.outlook\.com$", RegexOptions.IgnoreCase)]
    private static partial Regex SafeLinksHost();

    [GeneratedRegex("/_workitems/", RegexOptions.IgnoreCase)]
    private static partial Regex WorkItemsPath();
}
