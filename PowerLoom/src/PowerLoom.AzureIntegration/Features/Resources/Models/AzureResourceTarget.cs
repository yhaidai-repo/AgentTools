namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// A kind's checked input: the target as agents pass it, the write-only secret (Service Bus only) and what the page shows.
public sealed record AzureResourceTarget(string Target, string Secret, string Display);
