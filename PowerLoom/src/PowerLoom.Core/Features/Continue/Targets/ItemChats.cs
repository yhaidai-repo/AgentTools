using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Continue.Targets;

// What a chat on one kind of item asks for (user decision 2026-10-05): its opening line, the briefing's parts, its
// last step. Nothing changes in adoa until the user pastes the chat's answer or result there.
public static class ItemChats
{
    public sealed record Outline(string Opening, IReadOnlyList<string> Briefing, string Ending, string Rule);

    private static readonly Dictionary<ItemKind, Outline> Outlines = new()
    {
        [ItemKind.Question] = new(
            "Help me answer question",
            [
                "**The question**: in short, and what it blocks.",
                "**What we know**: from the notes and the code, with `file:line`.",
                "**Options**: each with pros and cons.",
                "**Suggested answer**.",
            ],
            "End by asking \"Use this answer?\" Change no file. After a yes, give the final answer as plain text to paste into adoa's answer form.",
            "Change no file: the answer is pasted into adoa."),
        [ItemKind.Human] = new(
            "Help me with human task",
            [
                "**The task**: in short.",
                "**Why**: what it blocks.",
                "**Steps**: mark the ones only I can do (access, people).",
                "**What to report back**.",
            ],
            "End by asking \"Shall I help with step 1?\" Change no file unless I ask. When the task is done, give the result as plain text to paste into adoa.",
            "Change no file unless the user asks."),
        [ItemKind.Finding] = new(
            "Help me review finding",
            [
                "**The finding**: in short, and the register it would go to (open questions or known issues).",
                "**Is it true?**: checked against the code and notes, with `file:line`.",
                "**Already recorded?**: a matching record in the project's registers, if any.",
                "**Recommendation**: submit as is, edit (with the edited title and text), or dismiss, and why.",
            ],
            "End by asking \"Submit, edit or dismiss?\" Change no file. After the answer, give the final title and text to paste into adoa's finding form.",
            "Change no file: the record is submitted through adoa."),
    };

    public static Outline? For(ItemKind kind) => Outlines.GetValueOrDefault(kind);
}
