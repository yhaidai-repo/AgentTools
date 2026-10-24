namespace PowerLoom.Features.Docs.Records.Models;

// Closes an open record a chat settled with the user: `Status` fixed (known issues), resolved, or duplicate (with the
// record it repeats); `DecidedBy` names who settled it, e.g. "the user in a chat".
public sealed record CloseRegisterRecordRequest(string Path, string Id, string Status, RecordRef? DuplicateOf, string Decision, string DecidedBy);
