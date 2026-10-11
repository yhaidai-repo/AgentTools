namespace PowerLoom.Infrastructure.VaultCapture.Models;

// One draft waiting in a vault's draft folder, as VaultCapture's `drafts` command lists it. `Path` is relative to the
// vault (e.g. draft/pvs-topic.md); `Preferred` marks a draft whose source starts with the preferred prefix.
public sealed record VaultDraft(string Name, string Title, string Project, string Captured, string Source, string Target, string Path, bool Preferred);
