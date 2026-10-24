using PowerLoom.Contracts;
using PowerLoom.Infrastructure.VaultCapture;
using PowerLoom.Infrastructure.VaultCapture.Models;

namespace PowerLoom.Api.Tests.Probes;

// Stands in for the PowerShell module: a title starting with "reject:" is refused, anything else becomes OQ-007.
public sealed class FakeVaultCapture : IVaultCapture
{
    public const string RecordId = "OQ-007";

    public List<(string Vault, NewRegisterRecord Record)> Added { get; } = [];

    public List<(string Vault, DraftCapture Draft)> Captured { get; } = [];

    // The draft folder of each vault as the tests set it; a name not listed is no draft any more.
    public Dictionary<string, List<VaultDraft>> Drafts { get; } = [];

    public Task<Outcome<string>> AddRegisterRecordAsync(string vault, NewRegisterRecord record, CancellationToken cancellation)
    {
        Added.Add((vault, record));

        var outcome = record.Title.StartsWith("reject:")
            ? Outcome<string>.Failure(Problem.Invalid("unknown project"))
            : Outcome<string>.Success(RecordId);

        return Task.FromResult(outcome);
    }

    // A draft named "reject-…" is refused; any other lands in draft/<name>.md.
    public Task<DraftCaptureResult> CaptureDraftAsync(string vault, DraftCapture draft, CancellationToken cancellation)
    {
        Captured.Add((vault, draft));

        var result = draft.Name.StartsWith("reject-")
            ? new DraftCaptureResult(false, "rejected", null, ["unknown target"])
            : new DraftCaptureResult(true, "created", $"draft/{draft.Name}.md", []);

        return Task.FromResult(result);
    }

    public Task<IReadOnlyList<VaultDraft>> ListDraftsAsync(string vault, string preferSource, CancellationToken cancellation)
    {
        var drafts = (Drafts.GetValueOrDefault(vault) ?? []).OrderByDescending(draft => draft.Source.StartsWith(preferSource)).ThenBy(draft => draft.Captured).ToList();

        return Task.FromResult<IReadOnlyList<VaultDraft>>(drafts);
    }

    public Task<IReadOnlyDictionary<string, bool>> IsDraftAsync(string vault, IReadOnlyCollection<string> names, CancellationToken cancellation)
    {
        var listed = (Drafts.GetValueOrDefault(vault) ?? []).Select(draft => draft.Name).ToHashSet();

        return Task.FromResult<IReadOnlyDictionary<string, bool>>(names.Distinct().ToDictionary(name => name, listed.Contains));
    }
}
