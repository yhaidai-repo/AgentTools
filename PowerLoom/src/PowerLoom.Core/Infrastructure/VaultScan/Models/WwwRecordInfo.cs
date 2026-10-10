namespace PowerLoom.Infrastructure.VaultScan.Models;

// One record of a www-log.md as its heading and fields say.
public sealed record WwwRecordInfo(string Id, string Title, string Created, string Updated, string Kind, string Project, string Fault, string Status);
