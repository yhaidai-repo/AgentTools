namespace DevSecrets.DevHub.Models;

// One owner's recordings folder: its size and the newest write in it.
public sealed record OwnerArtifacts(string Owner, long Bytes, DateTimeOffset ModifiedAt);
