using System.Text.RegularExpressions;
using PowerLoom.Contracts;
using PowerLoom.GoogleDriveIntegration.Client;
using PowerLoom.GoogleDriveIntegration.Client.Models;
using PowerLoom.GoogleDriveIntegration.Features.Connection.Models;
using PowerLoom.GoogleDriveIntegration.Settings;

namespace PowerLoom.GoogleDriveIntegration.Features.Connection;

// Settings → Data access → Google Drive (user decision 2026-10-25): the vault's switch and OAuth client, the sign-in
// (traded here, so the secret and the token never reach the browser), and the folders agents may read, each checked
// against Drive when added.
public sealed partial class GoogleDriveConnection(GoogleDriveSettingsStore store, IGoogleApi google)
{
    private const string NoClient = "Enter the Google OAuth client (a Desktop app's client ID and secret) first.";

    public async Task<Outcome<GoogleDriveSettings>> SaveAsync(string vault, SaveGoogleDriveRequest request, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var clientId = (request.ClientId ?? "").Trim();
        var changed = clientId != settings.ClientId;

        settings.Enabled = request.Enabled;
        settings.ClientId = clientId;
        settings.ClientSecret = string.IsNullOrWhiteSpace(request.ClientSecret) ? settings.ClientSecret : request.ClientSecret.Trim();

        if (request.Enabled && !settings.HasClient)
            return Outcome<GoogleDriveSettings>.Failure(Problem.Invalid(NoClient));

        // A sign-in belongs to its client: another client needs a new one.
        settings.RefreshToken = changed ? "" : settings.RefreshToken;
        settings.Account = changed ? "" : settings.Account;
        await store.SaveAsync(vault, settings, cancellation);

        return Outcome<GoogleDriveSettings>.Success(settings);
    }

    public async Task<Outcome<GoogleDriveSettings>> SignInAsync(string vault, GoogleSignInRequest request, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);

        if (!settings.HasClient)
            return Outcome<GoogleDriveSettings>.Failure(Problem.Invalid(NoClient));

        try
        {
            var signIn = await google.SignInAsync(ClientOf(settings), request.Code, request.CodeVerifier, request.RedirectUri, cancellation);

            settings.RefreshToken = signIn.RefreshToken;
            settings.Account = signIn.Account;
        }
        catch (GoogleRequestException error)
        {
            return Outcome<GoogleDriveSettings>.Failure(Problem.Invalid($"Google refused the sign-in: {error.Message}"));
        }

        await store.SaveAsync(vault, settings, cancellation);

        return Outcome<GoogleDriveSettings>.Success(settings);
    }

    public async Task<GoogleDriveSettings> SignOutAsync(string vault, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);

        settings.RefreshToken = "";
        settings.Account = "";
        await store.SaveAsync(vault, settings, cancellation);

        return settings;
    }

    public async Task<Outcome<GoogleDriveSettings>> AddFolderAsync(string vault, AddGoogleDriveFolderRequest request, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);
        var id = FolderIdOf(request.Folder);

        if (!settings.IsSignedIn)
            return Outcome<GoogleDriveSettings>.Failure(Problem.Invalid("Sign in with Google first: the folder is checked with that account."));

        if (id is null)
            return Outcome<GoogleDriveSettings>.Failure(Problem.Invalid($"Not a Drive folder link or id: {request.Folder}"));

        var folder = await FolderAsync(settings, id, cancellation);

        if (!folder.Ok)
            return Outcome<GoogleDriveSettings>.Failure(folder.Problem!);

        settings.Folders = [.. settings.Folders.Where(entry => entry.Id != id), new GoogleDriveFolder { Id = id, Name = folder.Value!.Name }];
        await store.SaveAsync(vault, settings, cancellation);

        return Outcome<GoogleDriveSettings>.Success(settings);
    }

    public async Task<GoogleDriveSettings> RemoveFolderAsync(string vault, string id, CancellationToken cancellation)
    {
        var settings = await store.ReadAsync(vault, cancellation);

        settings.Folders = settings.Folders.Where(entry => entry.Id != id).ToList();
        await store.SaveAsync(vault, settings, cancellation);

        return settings;
    }

    public static GoogleDriveSummary SummaryOf(GoogleDriveSettings settings)
    {
        return new GoogleDriveSummary(settings.Enabled, settings.ClientId, settings.ClientSecret.Length > 0, settings.Account, settings.Folders.Select(folder => new GoogleDriveFolderSummary(folder.Id, folder.Name)).ToList());
    }

    /// <summary>The id in a folder link (…/folders/&lt;id&gt;, also under /u/0/) or a bare id; null for anything else.</summary>
    public static string? FolderIdOf(string folder)
    {
        var text = folder.Trim();
        var fromLink = FolderLink().Match(text);

        if (fromLink.Success)
            return fromLink.Groups[1].Value;

        return BareId().IsMatch(text) ? text : null;
    }

    private async Task<Outcome<DriveItem>> FolderAsync(GoogleDriveSettings settings, string id, CancellationToken cancellation)
    {
        try
        {
            var item = await google.GetItemAsync(ClientOf(settings), settings.RefreshToken, id, cancellation);

            if (item is null)
                return Outcome<DriveItem>.Failure(Problem.NotFound($"{settings.Account} can't see a Drive item {id}."));

            return item.IsFolder ? Outcome<DriveItem>.Success(item) : Outcome<DriveItem>.Failure(Problem.Invalid($"{item.Name} is a file, not a folder."));
        }
        catch (GoogleRequestException error)
        {
            return Outcome<DriveItem>.Failure(Problem.Invalid(error.Message));
        }
    }

    private static GoogleClient ClientOf(GoogleDriveSettings settings) => new(settings.ClientId, settings.ClientSecret);

    [GeneratedRegex(@"^https://drive\.google\.com/drive/(?:u/\d+/)?folders/([\w-]+)")]
    private static partial Regex FolderLink();

    [GeneratedRegex(@"^[\w-]{10,}$")]
    private static partial Regex BareId();
}
