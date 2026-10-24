namespace PowerLoom.Features.Continue.Targets;

// The chat's first answer on a PBI (user decision 2026-10-05): a plain-language briefing, then a request to implement.
// PowerLoom can't tell bugs from features (ADO types and tags are used loosely), so the chat picks the outline after reading.
public static class ImplementBriefing
{
    public static readonly IReadOnlyList<string> Bug =
    [
        "**The problem**: in short, what goes wrong and why, in 2–3 sentences.",
        "**How it should work**: the intended flow, step by step.",
        "**Where it breaks**: each cause with `file:line`; a table when several places behave differently.",
        "**How this explains each symptom**: every reported symptom and acceptance criterion, tied to its cause.",
    ];

    public static readonly IReadOnlyList<string> Feature =
    [
        "**The goal**: in short, what the user gets and why, in 2–3 sentences.",
        "**How it works today**: the current flow the change builds on, with `file:line`.",
        "**What changes**: the new behaviour for every acceptance criterion; a table when several places change.",
        "**Decisions it rests on**: the answered questions and the design's assumptions and alternatives not taken.",
    ];

    // Both outlines end the same way.
    public static readonly IReadOnlyList<string> End =
    [
        "**What the plan does**: the plan steps grouped by purpose and why each is needed; name the user steps you don't do.",
        "**Risks to keep in mind**: the design's risks, open findings and unchecked assumptions.",
    ];

    public static string OutlinesMarkdown()
    {
        return $"Bug (it fixes wrong behaviour):\n{Numbered(Bug.Concat(End))}\n\nFeature (new or changed behaviour):\n{Numbered(Feature.Concat(End))}";
    }

    private static string Numbered(IEnumerable<string> parts) => string.Join("\n", parts.Select((part, index) => $"{index + 1}. {part}"));
}
