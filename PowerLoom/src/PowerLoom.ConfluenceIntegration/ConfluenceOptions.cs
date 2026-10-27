namespace PowerLoom.ConfluenceIntegration;

// An Atlassian account's email and API token (id.atlassian.com → Security → API tokens): the client sees what the
// account sees. Both empty = Confluence isn't set up; the pages become the user's tasks then.
public sealed class ConfluenceOptions
{
    public const string Section = "Confluence";

    public string Email { get; set; } = "";

    public string ApiToken { get; set; } = "";

    public string Site { get; set; } = "";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(Email) && !string.IsNullOrWhiteSpace(ApiToken) && Uri.TryCreate(Site, UriKind.Absolute, out var site) && site.Scheme == "https" && site.UserInfo.Length == 0;
}
