using PowerLoom.Contracts;
using PowerLoom.Infrastructure.VaultCapture;
using PowerLoom.Infrastructure.VaultCapture.Models;

namespace PowerLoom.Api.Tests.Probes;

// Stands in for the PowerShell module: a title starting with "reject:" is refused, anything else becomes OQ-007.
public sealed class FakeVaultCapture : IVaultCapture
{
    public const string RecordId = "OQ-007";

    public List<(string Vault, NewRegisterRecord Record)> Added { get; } = [];

    public Task<Outcome<string>> AddRegisterRecordAsync(string vault, NewRegisterRecord record, CancellationToken cancellation)
    {
        Added.Add((vault, record));

        var outcome = record.Title.StartsWith("reject:")
            ? Outcome<string>.Failure(Problem.Invalid("unknown project"))
            : Outcome<string>.Success(RecordId);

        return Task.FromResult(outcome);
    }
}
