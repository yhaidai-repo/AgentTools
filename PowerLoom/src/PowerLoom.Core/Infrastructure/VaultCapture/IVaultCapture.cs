using PowerLoom.Contracts;
using PowerLoom.Infrastructure.VaultCapture.Models;

namespace PowerLoom.Infrastructure.VaultCapture;

// The user's VaultCapture module, which owns the docs vaults' draft and register rules.
public interface IVaultCapture
{
    // Invalid input comes back as a problem; the new record's id otherwise.
    Task<Outcome<string>> AddRegisterRecordAsync(string vault, NewRegisterRecord record, CancellationToken cancellation);
}
