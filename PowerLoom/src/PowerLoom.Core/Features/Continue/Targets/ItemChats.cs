using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Continue.Targets;

// What a chat on one kind of item asks for (user decision 2026-10-05): its opening line, the briefing's parts, its
// last step. Nothing changes in PowerLoom until the user pastes the chat's answer or result there.
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
            "End by asking \"Use this answer?\" Change no file. After a yes, give the final answer as plain text to paste into PowerLoom's answer form.",
            "Change no file: the answer is pasted into PowerLoom."),
        [ItemKind.Human] = new(
            "Help me with human task",
            [
                "**The task**: in short.",
                "**Why**: what it blocks.",
                "**Steps**: mark the ones only I can do (access, people).",
                "**What to report back**.",
            ],
            "End by asking \"Shall I help with step 1?\" Change no file unless I ask. When the task is done, give the result as plain text to paste into PowerLoom.",
            "Change no file unless the user asks."),
        [ItemKind.Finding] = new(
            "Help me review finding",
            [
                "**The finding**: in short, and the register it would go to (open questions or known issues).",
                "**Is it true?**: checked against the code and notes, with `file:line`.",
                "**Already recorded?**: a matching record in the project's registers, if any.",
                "**Recommendation**: submit as is, edit (with the edited title and text), or dismiss, and why.",
            ],
            "End by asking \"Submit, edit or dismiss?\" Change no file. After the answer, give the final title and text to paste into PowerLoom's finding form.",
            "Change no file: the record is submitted through PowerLoom."),
    };

    // Any agent task, whatever its kind or status (user decision 2026-10-16): talk over what the agent did and what's next.
    private static readonly Outline AgentTask = new(
        "Help me follow up on agent task",
        [
            "**The task**: what it asked for, in short.",
            "**What the agent did**: its result, from the task and the notes it wrote, with `file:line` where it read code.",
            "**What is left or doubtful**: open questions, gaps, anything that looks wrong.",
            "**Next step**: what I should do now (answer a question, re-run the task, change code, or nothing).",
        ],
        "End by asking \"What next?\" Change no file unless I ask. Anything for PowerLoom (an answer, a re-run reason) is given as plain text to paste there.",
        "Change no file unless the user asks.");

    public static Outline? For(LocalItem item) => AgentStages.IsAgentTask(item.Assignee) ? AgentTask : Outlines.GetValueOrDefault(item.Kind);
}
