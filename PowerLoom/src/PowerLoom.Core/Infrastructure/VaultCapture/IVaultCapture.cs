using PowerLoom.Contracts;
using PowerLoom.Infrastructure.VaultCapture.Models;

namespace PowerLoom.Infrastructure.VaultCapture;

// The user's VaultCapture module, which owns the docs vaults' draft and register rules.
public interface IVaultCapture
{
    // Invalid input comes back as a problem; the new record's id otherwise.
    Task<Outcome<string>> AddRegisterRecordAsync(string vault, NewRegisterRecord record, CancellationToken cancellation);

    // A rejected draft is an answer (its errors), not a failure.
    Task<DraftCaptureResult> CaptureDraftAsync(string vault, DraftCapture draft, CancellationToken cancellation);

    // The drafts in the order a writer takes them: those whose source starts with `preferSource` first, then oldest first.
    Task<IReadOnlyList<VaultDraft>> ListDraftsAsync(string vault, string preferSource, CancellationToken cancellation);

    // Whether each named note is still a draft (not yet merged and removed from the draft folder).
    Task<IReadOnlyDictionary<string, bool>> IsDraftAsync(string vault, IReadOnlyCollection<string> names, CancellationToken cancellation);
}
