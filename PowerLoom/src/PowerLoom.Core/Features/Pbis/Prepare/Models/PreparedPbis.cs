namespace PowerLoom.Features.Pbis.Prepare.Models;

// The PBIs queued for preparation; ids PowerLoom doesn't have are skipped.
public sealed record PreparedPbis(List<int> Queued, List<int> Unknown);
