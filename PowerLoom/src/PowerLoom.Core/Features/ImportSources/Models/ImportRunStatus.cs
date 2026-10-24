using PowerLoom.Contracts.Imports;

namespace PowerLoom.Features.ImportSources.Models;

// The sync's last look at the import sources; saved because the web can't see the import inbox folder. `Configured`
// is false when Import:InboxRoot isn't set.
public sealed record ImportRunStatus(bool Configured, string CheckedAt, IReadOnlyList<ImportSourceStatus> Sources);
