namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// A kind's checked input: the account name as agents pass it, and what the page shows.
public sealed record AzureResourceTarget(string Target, string Display);
