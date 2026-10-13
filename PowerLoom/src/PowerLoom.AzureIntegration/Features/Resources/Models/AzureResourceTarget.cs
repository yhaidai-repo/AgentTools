namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// A kind's checked input: the public target, the write-only secret and what the page shows.
public sealed record AzureResourceTarget(string Target, string Secret, string Display);
