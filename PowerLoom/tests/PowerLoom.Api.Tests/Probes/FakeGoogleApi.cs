using PowerLoom.GoogleDriveIntegration.Client;
using PowerLoom.GoogleDriveIntegration.Client.Models;

namespace PowerLoom.Api.Tests.Probes;

// Google as the tests set it up: a sign-in with `GoodCode` succeeds as `Account`; `Items` is what Drive shows.
public sealed class FakeGoogleApi : IGoogleApi
{
    public const string GoodCode = "good-code";

    public string Account { get; set; } = "sam@example.com";

    public Dictionary<string, DriveItem> Items { get; } = [];

    public List<(GoogleClient Client, string CodeVerifier, string RedirectUri)> SignIns { get; } = [];

    public Task<GoogleSignIn> SignInAsync(GoogleClient client, string code, string codeVerifier, string redirectUri, CancellationToken cancellation)
    {
        SignIns.Add((client, codeVerifier, redirectUri));

        if (code != GoodCode)
            throw new GoogleRequestException(400, "Google answered 400: invalid_grant");

        return Task.FromResult(new GoogleSignIn("refresh-1", Account));
    }

    public Task<DriveItem?> GetItemAsync(GoogleClient client, string refreshToken, string id, CancellationToken cancellation)
    {
        return Task.FromResult(Items.GetValueOrDefault(id));
    }
}
