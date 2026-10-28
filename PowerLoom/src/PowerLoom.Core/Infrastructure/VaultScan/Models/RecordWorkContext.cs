namespace PowerLoom.Infrastructure.VaultScan.Models;

// Unknown ids stay absent. The actual chat id takes precedence over the transport session id.
public sealed record RecordWorkContext(int? PbiId = null, string? TaskId = null, string? ChatId = null, string? SessionId = null);
