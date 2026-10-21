namespace DevSecrets.DevHub.Models;

// What a delete of an owner's recordings removed, or would remove in a dry run.
public sealed record DeletedArtifacts(string Owner, int Files, long Bytes, bool DryRun);
