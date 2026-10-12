namespace PowerLoom.AzureIntegration.Features.Resources.Models;

public sealed record AddAzureResourceRequest(string Name, string Kind, string Target);
