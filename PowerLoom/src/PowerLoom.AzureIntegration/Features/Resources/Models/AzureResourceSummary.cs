namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// A resource as the page shows it: a Mongo string only by its host.
public sealed record AzureResourceSummary(string Name, string Kind, string Display, bool Enabled);
