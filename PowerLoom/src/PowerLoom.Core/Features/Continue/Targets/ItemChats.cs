using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Features.Continue.Targets;

// What a chat on one kind of item asks for (user decision 2026-10-05): its opening line, the briefing's parts, its
// last step. PowerLoom changes only through the commands under "At the end" (ItemChatEndings), after the user's yes
// (user decision 2026-10-21).
public static class ItemChats
{
    public sealed record Outline(string Opening, IReadOnlyList<string> Briefing, string Ending, string Rule);

    private const string CommandsOnly = "PowerLoom is written only through the commands under At the end, each after the user's yes; nothing is pasted.";

    private static readonly Dictionary<string, Outline> Outlines = new()
    {
        [ItemKinds.Question] = new(
            "Help me answer question",
            [
                "**The question**: in short, and what it blocks.",
                "**What we know**: from the notes and the code, with `file:line`.",
                "**Options**: each with pros and cons.",
                "**Suggested answer**.",
            ],
            "End by asking \"Use this answer?\" Change no file. After a yes, close the question with the answer by the command under At the end.",
            CommandsOnly),
        [ItemKinds.Human] = new(
            "Help me with human task",
            [
                "**The task**: in short.",
                "**Why**: what it blocks.",
                "**Steps**: mark the ones only I can do (access, people).",
                "**What to report back**.",
            ],
            "End by asking \"Shall I help with step 1?\" Change no file unless I ask. When the task is done, close it with the per-step results by the command under At the end.",
            "Change no file unless the user asks. " + CommandsOnly),
        [ItemKinds.Finding] = new(
            "Help me review finding",
            [
                "**The finding**: in short, and the register it would go to (open questions or known issues).",
                "**Is it true?**: checked against the code and notes, with `file:line`.",
                "**Already recorded?**: a matching record in the project's registers, if any.",
                "**Recommendation**: submit as is, edit (with the edited title and text), or dismiss, and why.",
            ],
            "End by asking \"Submit, edit or dismiss?\" Change no file. After the answer, submit, answer or dismiss the finding by the command under At the end, with the final title and text.",
            CommandsOnly),
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
        "End by asking \"What next?\" Change no file unless I ask. A re-run goes through the command under At the end.",
        "Change no file unless the user asks. " + CommandsOnly);

    public static Outline? For(LocalItem item) => AgentStages.IsAgentTask(item.Assignee) ? AgentTask : Outlines.GetValueOrDefault(item.Kind);
}
