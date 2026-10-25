using PowerLoom.Features.Pbis.Notes;
using PowerLoom.Features.Pbis.Notes.Models;
using PowerLoom.Infrastructure.Backlog;

namespace PowerLoom.Api.Tests.Pbis;

public sealed class ResultNoteRendererTests
{
    private static readonly DateTime Created = new(2026, 10, 22, 9, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void A_result_is_named_by_its_run_under_its_task_with_its_evidence()
    {
        var evidence = new[] { new ResultEvidence("S3", "POS/Vendors/VendorList.tsx:42", "the raw key is rendered", "{vendor.key}") };
        var note = new ResultNote(30474, 7, 2085, "AT-30474-001", "better-research", "complete", "# The key is shown raw\n\nDetails.", evidence, Created);

        var text = ResultNoteRenderer.Render(note, "");

        Assert.Equal("pbi/PBI-30474-x/tasks/AT-30474-001/RUN-2085.md", BacklogPaths.ResultNotePath("pbi/PBI-30474-x/PBI-30474.md", "AT-30474-001", 7, 2085));
        Assert.Contains("id: \"RUN-2085\"", text);
        Assert.Contains("title: \"The key is shown raw\"", text);
        Assert.Contains("task: \"[[AT-30474-001]]\"", text);
        Assert.Contains("# RUN-2085 The key is shown raw", text);
        Assert.Contains("Agent: better-research · Status: complete", text);
        Assert.Contains("- `POS/Vendors/VendorList.tsx:42`: the raw key is rendered — \"{vendor.key}\"", text);
    }

    [Fact]
    public void A_result_whose_run_and_task_are_gone_keeps_its_own_name_in_the_tasks_folder()
    {
        var note = new ResultNote(30474, 7, null, null, "design", "blocked", "Blocked on Q-30474-002.", [], Created);

        var text = ResultNoteRenderer.Render(note, "");

        Assert.Equal("pbi/PBI-30474-x/tasks/RESULT-7.md", BacklogPaths.ResultNotePath("pbi/PBI-30474-x/PBI-30474.md", null, 7, null));
        Assert.Contains("id: \"RESULT-7\"", text);
        Assert.Contains("task: null", text);
        Assert.Contains("## Evidence\n\n–", text);
    }

    [Fact]
    public void A_body_that_starts_with_a_paragraph_gives_a_capped_title()
    {
        var paragraph = string.Join(" ", Enumerable.Repeat("Catalog reads rules from Cosmos on every event", 6));
        var note = new ResultNote(30474, 8, 2676, "AT-30474-002", "better-research", "complete", paragraph, [], Created);

        var text = ResultNoteRenderer.Render(note, "");

        Assert.Contains("title: \"Catalog reads rules from Cosmos on every event Catalog reads rules from Cosmos on every event Catalog reads rules from C\\u2026\"", text);
        Assert.Contains($"\n\n{paragraph}\n\n", text);
    }
}
