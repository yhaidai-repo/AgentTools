namespace PowerLoom.Contracts.Confluence;

// Which of a PBI's linked Confluence pages a sync fetches: only those without a fetched copy (a first fetch or a
// retry), or all of them, their copies brought to the page's current version.
public enum PageSyncScope
{
    Missing,
    All,
}
