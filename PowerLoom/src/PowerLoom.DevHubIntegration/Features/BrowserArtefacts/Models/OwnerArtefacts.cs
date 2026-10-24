namespace PowerLoom.DevHubIntegration.Features.BrowserArtefacts.Models;

// One owner's recordings folder as DevHub lists it: PowerLoom's runs are `powerloom-run-<id>`.
public sealed record OwnerArtefacts(string Owner, long Bytes, DateTimeOffset ModifiedAt);
