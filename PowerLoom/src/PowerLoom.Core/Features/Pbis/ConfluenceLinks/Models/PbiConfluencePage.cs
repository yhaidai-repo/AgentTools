namespace PowerLoom.Features.Pbis.ConfluenceLinks.Models;

// A Confluence page useful for a PBI's later agents, like a relevant vault doc (the `work_item.confluence_pages` JSON):
// listed for them with why, opened by agents that have the Confluence tools (user decision 2026-10-02: links only, not
// fetched). `By`: user, refinement, research or design.
public sealed record PbiConfluencePage(string Url, string Title, string Why, string By);
