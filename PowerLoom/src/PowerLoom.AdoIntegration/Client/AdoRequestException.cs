namespace PowerLoom.AdoIntegration.Client;

// Azure DevOps refused or answered with something other than JSON (a bad or expired token shows an HTML sign-in page).
public sealed class AdoRequestException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
