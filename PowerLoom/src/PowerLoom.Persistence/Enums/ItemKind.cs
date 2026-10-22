namespace PowerLoom.Persistence.Enums;

// PostgreSQL enum `item_kind`; the labels are the kebab-case of the member names (KebabCaseNameTranslator).
public enum ItemKind
{
    Research,
    Design,
    Human,
    Question,
    ResearchResult,
    Refinement,
    Docs,
    Finding,
    Review,
    VaultReview,
    // Unused since 2026-10-22 (goal tasks removed; a user task of any kind replaces them); Postgres enums can't drop a value.
    Goal,
    // A recorded meeting to turn into notes and tasks (tools/audio-capture; design 2026-10-14).
    Meeting,
    // An Autotest task: prove a PBI's acceptance criteria end to end (design 2026-10-20).
    Test,
    // What an Autotest run found and planned.
    TestReport,
}
