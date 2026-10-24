namespace PowerLoom.Features.Docs.Records.Models;

// What closing a register record writes into it: the status word (Fixed or Resolved; a WWW record always becomes
// resolved), who decided and when, and one line on what settled it.
public sealed record RecordClosingEdit(string Status, string DecidedBy, string Decision);
