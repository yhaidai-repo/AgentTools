using System.Text.RegularExpressions;
using PowerLoom.Features.Pbis.Notes;
using PowerLoom.Features.Pbis.Notes.Models;
using PowerLoom.Infrastructure.Backlog;

namespace PowerLoom.Api.Tests.Pbis;

// The user's `## Notes` section survives every re-render once, whatever line endings the vault's template has.
public sealed class NotesSectionTests
{
    private static readonly PbiNote Note = new(7, "Login", "Product Backlog Item", "New", "", "new", null, null, null, null, [], "d", "a", null, null, null, DateTime.UnixEpoch, DateTime.UnixEpoch);

    [Fact]
    public void S3_03_External_headings_do_not_truncate_generated_content_or_become_user_notes()
    {
        const string template = "{{description}}\n{{acceptance_criteria}}\n## Notes\n";
        var note = Note with { DescriptionMd = "Description\n## Notes\nDescription tail", AcceptanceCriteriaMd = "AC\n## Notes\nAC tail", DiscussionMd = "Discussion\n## Notes\nDiscussion tail" };
        var rendered = PbiNoteRenderer.Render(template, note, "## Notes\n\nHuman text\n## Notes\nHuman tail\n", new Dictionary<string, string>());
        for (var i = 0; i < 3; i++)
        {
            Assert.Contains("Description tail", NotesSection.Before(rendered));
            Assert.Contains("AC tail", NotesSection.Before(rendered));
            Assert.Contains("Discussion tail", NotesSection.Before(rendered));
            Assert.Equal("Human text\n## Notes\nHuman tail", NotesSection.BodyOf(rendered));
            rendered = PbiNoteRenderer.Render(template, note, NotesSection.Of(rendered), new Dictionary<string, string>());
        }
    }

    [Fact]
    public void A_template_saved_with_Windows_line_endings_keeps_one_notes_section_over_many_renders()
    {
        const string template = "# {{id}} {{title}}\r\n\r\n## Description\r\n\r\n{{description}}\r\n\r\n## Notes\r\n";
        var note = PbiNoteRenderer.Render(template, Note, NotesSection.Of(null), new Dictionary<string, string>());

        for (var render = 0; render < 3; render++)
            note = PbiNoteRenderer.Render(template, Note, NotesSection.Of(NotesSection.Replace(note, "My own remark.")), new Dictionary<string, string>());

        Assert.Single(Regex.Matches(note, "^## Notes", RegexOptions.Multiline));
        Assert.DoesNotContain("\r", note);
        Assert.Equal("My own remark.", NotesSection.BodyOf(note));
    }

    [Fact]
    public void The_empty_headings_an_earlier_render_stacked_are_dropped()
    {
        const string broken = "# PBI\n\n## Notes\n\n## Notes\n\n## Notes\n\nMy own remark.\n";

        Assert.Equal("## Notes\n\nMy own remark.\n", NotesSection.Of(broken));
        Assert.Equal("My own remark.", NotesSection.BodyOf(broken));
    }
}
