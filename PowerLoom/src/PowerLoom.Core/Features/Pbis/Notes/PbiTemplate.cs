using System.Text.RegularExpressions;

namespace PowerLoom.Features.Pbis.Notes;

// Seeded to `_templates/pbi.md` when missing; after that the vault file is the template and the user owns it.
public static partial class PbiTemplate
{
    public const string Default = """
        # {{id}} {{title}}

        | Field | Value |
        |---|---|
        | Azure DevOps | [{{ado_id}}]({{ado_url}}) |
        | Type | {{ado_type}} |
        | ADO state | {{ado_state}} |
        | Sprint | {{iteration}} |
        | Area | {{area}} |
        | Assigned to | {{assigned_to}} |
        | Priority | {{priority}} |
        | Tags | {{tags}} |

        ## Description

        {{description}}

        ## Acceptance criteria

        {{acceptance_criteria}}

        ## Refinement

        <!-- adoa:begin refinement -->
        Pending.
        <!-- adoa:end refinement -->

        ## Items

        <!-- adoa:begin items -->
        None yet.
        <!-- adoa:end items -->

        ## Notes

        """;

    // Unknown placeholders stay visible so template typos are easy to spot.
    public static string Fill(string template, IReadOnlyDictionary<string, string> values)
    {
        return Placeholder().Replace(template, match => values.TryGetValue(match.Groups[1].Value, out var value) ? value : match.Value);
    }

    [GeneratedRegex(@"\{\{\s*(\w+)\s*\}\}")]
    private static partial Regex Placeholder();
}
