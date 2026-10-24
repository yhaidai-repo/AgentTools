namespace PowerLoom.ConfluenceIntegration.Client;

// A failed Confluence call; the message is meant for the user (it ends up in their task when a page can't be fetched).
public sealed class ConfluenceRequestException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
