namespace PowerLoom.Features.Pbis.Prepare.Models;

// The PBIs queued for preparation; ids PowerLoom doesn't have are skipped, and so are PBIs the user closed (reopen first).
public sealed record PreparedPbis(List<int> Queued, List<int> Unknown, List<int> Closed);
