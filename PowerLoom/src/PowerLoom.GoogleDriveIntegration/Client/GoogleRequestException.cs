namespace PowerLoom.GoogleDriveIntegration.Client;

// Google refused a call (a bad client, an expired or revoked sign-in, no access to a folder).
public sealed class GoogleRequestException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
