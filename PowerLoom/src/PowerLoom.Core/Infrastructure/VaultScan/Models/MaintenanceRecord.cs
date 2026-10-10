namespace PowerLoom.Infrastructure.VaultScan.Models;

// One record of a maintenance register (WWW, KI, OQ): `Kind` www, issues or questions; `Path` the register note;
// `Status` Open, Resolved, Fixed… (empty without one); `Text` from the record's heading to the next heading.
public sealed record MaintenanceRecord(string Kind, string Path, string Id, string Title, string Status, bool IsOpen, string? Updated, string Text);
