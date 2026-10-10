namespace PowerLoom.Infrastructure.VaultScan.Models;

// One line of VaultUsage's log (`<vault>/.usage/usage.jsonl`): `File` relative to the vault root, `Kind` read, search,
// write or shell, `Agent` e.g. "claude-code" or "adoa:research".
public sealed record VaultUsageEvent(DateTime At, string File, string Kind, string Agent);
