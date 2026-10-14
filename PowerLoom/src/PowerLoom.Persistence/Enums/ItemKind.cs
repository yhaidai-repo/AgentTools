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
    Goal,
    // A recorded meeting to turn into notes and tasks (tools/audio-capture; design 2026-10-14).
    Meeting,
}
