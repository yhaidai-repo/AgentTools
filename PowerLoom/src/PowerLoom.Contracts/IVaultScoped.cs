namespace PowerLoom.Contracts;

// A message that works on one vault. Messages of one vault never run at the same time (partitioned by Vault), so
// syncs and note writes of a vault can't overlap.
public interface IVaultScoped
{
    string Vault { get; }
}
