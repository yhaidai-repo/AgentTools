using Microsoft.Extensions.Options;

namespace PowerLoom.Infrastructure.Vault;

public sealed class VaultRoots(IOptions<VaultOptions> options)
{
    public string RootOf(string vault) => Path.Combine(options.Value.Root, vault);
}
