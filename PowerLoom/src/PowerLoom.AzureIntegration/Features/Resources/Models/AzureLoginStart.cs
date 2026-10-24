namespace PowerLoom.AzureIntegration.Features.Resources.Models;

// What the user needs to finish a device-code sign-in: the code to type at the link.
public sealed record AzureLoginStart(string FlowId, string UserCode, string VerificationUri, string Message, int ExpiresInSeconds);
