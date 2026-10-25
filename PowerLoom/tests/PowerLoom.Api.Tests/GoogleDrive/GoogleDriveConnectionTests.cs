using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.GoogleDriveIntegration.Client.Models;
using PowerLoom.GoogleDriveIntegration.Features.Connection;
using PowerLoom.GoogleDriveIntegration.Features.Connection.Models;
using PowerLoom.GoogleDriveIntegration.Settings;

namespace PowerLoom.Api.Tests.GoogleDrive;

// Settings → Data access → Google Drive (user decision 2026-10-25): the user's OAuth client, the sign-in traded by
// PowerLoom, and the folders agents may read.
[Collection(PowerLoomCollection.Name)]
public sealed class GoogleDriveConnectionTests(PowerLoomHost host)
{
    private static readonly string Url = $"/api/vaults/{PowerLoomHost.Vault}/google-drive";

    private FakeGoogleApi Google => host.Host.Services.GetRequiredService<FakeGoogleApi>();

    [Fact]
    public async Task Signing_in_keeps_the_token_from_the_page_and_a_new_client_needs_a_new_sign_in()
    {
        await host.Host.PutJson(new SaveGoogleDriveRequest(true, "client-1", "secret-1"), Url).Receive<GoogleDriveSummary>();

        var signedIn = await host.Host.PostJson(new GoogleSignInRequest(FakeGoogleApi.GoodCode, "verifier", "http://127.0.0.1:3100/settings/google-drive/callback"), $"{Url}/sign-in").Receive<GoogleDriveSummary>();
        var stored = await StoredAsync();
        var otherClient = await host.Host.PutJson(new SaveGoogleDriveRequest(true, "client-2", null), Url).Receive<GoogleDriveSummary>();

        Assert.Equal(("client-1", true, "sam@example.com"), (signedIn!.ClientId, signedIn.HasClientSecret, signedIn.Account));
        Assert.Equal(("refresh-1", "secret-1"), (stored.RefreshToken, stored.ClientSecret));
        Assert.Equal((new GoogleClient("client-1", "secret-1"), "verifier"), (Google.SignIns[^1].Client, Google.SignIns[^1].CodeVerifier));
        Assert.Equal("", otherClient!.Account);
        Assert.Equal(("", "secret-1"), ((await StoredAsync()).RefreshToken, (await StoredAsync()).ClientSecret));
    }

    [Fact]
    public async Task A_refused_sign_in_and_a_switch_without_a_client_are_refused()
    {
        await host.Host.PutJson(new SaveGoogleDriveRequest(false, "client-3", "secret-3"), Url).Receive<GoogleDriveSummary>();

        await StatusAsync(scenario => scenario.Post.Json(new GoogleSignInRequest("bad-code", "v", "http://127.0.0.1:3100/x")).ToUrl($"{Url}/sign-in"), HttpStatusCode.BadRequest);
        await StatusAsync(scenario => scenario.Put.Json(new SaveGoogleDriveRequest(true, "", null)).ToUrl(Url), HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task A_folder_is_added_by_its_link_with_its_name_and_a_file_or_an_unknown_id_is_refused()
    {
        Google.Items["1AbCdEfGhIjK"] = new DriveItem("1AbCdEfGhIjK", "Specs", true);
        Google.Items["1FileFileFile"] = new DriveItem("1FileFileFile", "notes.txt", false);
        await host.Host.PutJson(new SaveGoogleDriveRequest(true, "client-4", "secret-4"), Url).Receive<GoogleDriveSummary>();
        await host.Host.PostJson(new GoogleSignInRequest(FakeGoogleApi.GoodCode, "v", "http://127.0.0.1:3100/x"), $"{Url}/sign-in").Receive<GoogleDriveSummary>();

        var added = await host.Host.PostJson(new AddGoogleDriveFolderRequest("https://drive.google.com/drive/u/0/folders/1AbCdEfGhIjK?usp=sharing"), $"{Url}/folders").Receive<GoogleDriveSummary>();

        await StatusAsync(scenario => scenario.Post.Json(new AddGoogleDriveFolderRequest("1FileFileFile")).ToUrl($"{Url}/folders"), HttpStatusCode.BadRequest);
        await StatusAsync(scenario => scenario.Post.Json(new AddGoogleDriveFolderRequest("1MissingMissing")).ToUrl($"{Url}/folders"), HttpStatusCode.NotFound);

        var removed = await host.Host.Scenario(scenario => scenario.Delete.Url($"{Url}/folders/1AbCdEfGhIjK"));

        Assert.Equal([new GoogleDriveFolderSummary("1AbCdEfGhIjK", "Specs")], added!.Folders);
        Assert.Empty((await removed.ReadAsJsonAsync<GoogleDriveSummary>())!.Folders);
    }

    [Theory]
    [InlineData("https://drive.google.com/drive/folders/1AbC-d_EfGhIj", "1AbC-d_EfGhIj")]
    [InlineData("https://drive.google.com/drive/u/1/folders/0AbCdEfGhIjKlUk9PVA", "0AbCdEfGhIjKlUk9PVA")]
    [InlineData("  1AbCdEfGhIjK  ", "1AbCdEfGhIjK")]
    [InlineData("https://docs.google.com/document/d/1AbCdEfGhIjK/edit", null)]
    [InlineData("short", null)]
    public void A_folder_is_named_by_its_link_or_id(string folder, string? id)
    {
        Assert.Equal(id, GoogleDriveConnection.FolderIdOf(folder));
    }

    private async Task StatusAsync(Action<Scenario> request, HttpStatusCode status)
    {
        await host.Host.Scenario(scenario =>
        {
            request(scenario);
            scenario.StatusCodeShouldBe(status);
        });
    }

    private async Task<GoogleDriveSettings> StoredAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<GoogleDriveSettingsStore>().ReadAsync(PowerLoomHost.Vault, CancellationToken.None);
    }
}
