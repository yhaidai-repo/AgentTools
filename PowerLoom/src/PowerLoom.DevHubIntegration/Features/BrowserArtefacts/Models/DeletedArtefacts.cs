namespace PowerLoom.DevHubIntegration.Features.BrowserArtefacts.Models;

// DevHub's answer to a delete (or a dry run of one): what went, or would go.
public sealed record DeletedArtefacts(string Owner, int Files, long Bytes, bool DryRun);
