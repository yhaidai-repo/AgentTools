using System.Text.Json;
using System.Text.RegularExpressions;
using PowerLoom.AdoIntegration.Client;
using PowerLoom.Infrastructure.Text;

namespace PowerLoom.AdoIntegration.Features.SyncPbis;

// A team's own rich-text fields on a work item (e.g. Notes with dev notes), beyond the description and acceptance
// criteria, so agents read them with the note (user decision 2026-10-15). A field counts when it holds HTML and isn't
// one of ADO's own (System.*), each under its name.
public static partial class ExtraTextFields
{
    private static readonly HashSet<string> ShownFields = [AdoFields.Description, AdoFields.ReproSteps, AdoFields.AcceptanceCriteria];

    public static string Render(Dictionary<string, JsonElement> fields)
    {
        var sections = fields
            .Where(field => IsExtraText(field.Key, field.Value))
            .OrderBy(field => field.Key, StringComparer.Ordinal)
            .Select(field => Section(field.Key, field.Value.GetString()!))
            .Where(section => section is not null);

        return string.Join("\n\n", sections);
    }

    private static bool IsExtraText(string name, JsonElement value)
    {
        var isOwnField = name.StartsWith("System.", StringComparison.Ordinal) || ShownFields.Contains(name);

        return !isOwnField && value.ValueKind == JsonValueKind.String && Html().IsMatch(value.GetString()!);
    }

    private static string? Section(string name, string html)
    {
        var markdown = HtmlMarkdown.Convert(html).ReplaceLineEndings("\n").Trim();

        return markdown.Length == 0 ? null : $"### {Label(name)}\n\n{Heading().Replace(markdown, "#### ")}";
    }

    // Custom.DevNotes → Dev Notes.
    private static string Label(string name) => WordStart().Replace(name.Split('.')[^1], " $1");

    [GeneratedRegex(@"<(p|div|br|ul|ol|li|span|b|strong|em|i|table|h[1-6])\b", RegexOptions.IgnoreCase)]
    private static partial Regex Html();

    // A field's own headings sit below its section, so none of them can end the note's generated part.
    [GeneratedRegex(@"^#{1,6}[ \t]+", RegexOptions.Multiline)]
    private static partial Regex Heading();

    [GeneratedRegex(@"(?<=[a-z0-9])([A-Z])")]
    private static partial Regex WordStart();
}
