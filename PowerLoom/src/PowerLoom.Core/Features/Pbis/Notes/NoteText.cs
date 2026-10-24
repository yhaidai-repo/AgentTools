using System.Text.Json;
using System.Text.RegularExpressions;

namespace PowerLoom.Features.Pbis.Notes;

// The small pieces every rendered note shares: frontmatter, dates, table cells, generated regions.
public static partial class NoteText
{
    public const string Empty = "–";

    // JSON strings are valid YAML double-quoted scalars, which also keeps [[links]] intact.
    public static string Frontmatter(IEnumerable<(string Key, object? Value)> fields)
    {
        var lines = fields.Select(field => $"{field.Key}: {YamlValue(field.Value)}");

        return $"---\n{string.Join("\n", lines)}\n---";
    }

    public static string IsoDate(DateTime date) => date.ToUniversalTime().ToString("yyyy-MM-dd");

    public static string EscapeCell(string value) => LineBreak().Replace(value.Replace("|", "\\|"), " ");

    public static string Bullets(IEnumerable<string> items)
    {
        var list = items.ToList();

        return list.Count > 0 ? string.Join("\n", list.Select(item => $"- {item}")) : "None.";
    }

    // Generated regions are rewritten on every render; everything else except `## Notes` is too.
    public static string Region(string name, string body) => $"<!-- adoa:begin {name} -->\n{body}\n<!-- adoa:end {name} -->";

    // Replaces the content between `<!-- adoa:begin name -->` and `<!-- adoa:end … -->`; unknown regions are left as is.
    public static string ReplaceRegions(string body, IReadOnlyDictionary<string, string> regions)
    {
        return regions.Aggregate(body, (text, region) => ReplaceRegion(text, region.Key, region.Value));
    }

    private static string ReplaceRegion(string body, string name, string content)
    {
        var pattern = new Regex($@"(<!-- adoa:begin {Regex.Escape(name)} -->\n)[\s\S]*?(\n<!-- adoa:end[^>]*-->)");

        return pattern.Replace(body, match => $"{match.Groups[1].Value}{content}{match.Groups[2].Value}", 1);
    }

    private static string YamlValue(object? value)
    {
        return value switch
        {
            null => "null",
            string text => JsonSerializer.Serialize(text),
            IEnumerable<string> items => $"[{string.Join(", ", items.Select(item => JsonSerializer.Serialize(item)))}]",
            bool flag => flag ? "true" : "false",
            IFormattable number => number.ToString(null, System.Globalization.CultureInfo.InvariantCulture),
            _ => value.ToString() ?? "null",
        };
    }

    [GeneratedRegex(@"\r?\n")]
    private static partial Regex LineBreak();
}
