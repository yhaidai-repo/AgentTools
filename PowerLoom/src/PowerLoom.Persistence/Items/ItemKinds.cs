namespace PowerLoom.Persistence.Items;

// `local_item.kind` is text (user decision 2026-10-24: an agent created in the UI may handle a task type of its own,
// e.g. "security-review"); these are the built-in kinds the code needs.
public static class ItemKinds
{
    public const string Research = "research";

    public const string Design = "design";

    public const string Human = "human";

    public const string Question = "question";

    public const string ResearchResult = "research-result";

    public const string Refinement = "refinement";

    public const string Docs = "docs";

    public const string Finding = "finding";

    public const string Review = "review";

    public const string VaultReview = "vault-review";

    // A recorded meeting to turn into notes and tasks (tools/audio-capture; design 2026-10-14).
    public const string Meeting = "meeting";

    // An Autotest task: prove a PBI's acceptance criteria end to end (design 2026-10-20).
    public const string Test = "test";

    // What an Autotest run found and planned.
    public const string TestReport = "test-report";

    public const string DemonstrationResult = "demonstration-result";

    private static readonly HashSet<string> BuiltIn = [Research, Design, Human, Question, ResearchResult, Refinement, Docs, Finding, Review, VaultReview, Meeting, Test, TestReport, DemonstrationResult];

    /// <summary>False for a task type of its own that an agent created in the UI handles.</summary>
    public static bool IsBuiltIn(string kind) => BuiltIn.Contains(kind);
}
