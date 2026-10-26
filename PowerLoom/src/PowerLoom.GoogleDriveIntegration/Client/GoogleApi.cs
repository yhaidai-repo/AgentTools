using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using PowerLoom.GoogleDriveIntegration.Client.Models;

namespace PowerLoom.GoogleDriveIntegration.Client;

public sealed class GoogleApi(IHttpClientFactory httpClients) : IGoogleApi
{
    private const string TokenUrl = "https://oauth2.googleapis.com/token";
    private const string FilesUrl = "https://www.googleapis.com/drive/v3/files";
    private const string FolderType = "application/vnd.google-apps.folder";

    // The OAuth token endpoint answers in snake_case (access_token), the Drive API in camelCase (mimeType).
    private static readonly JsonSerializerOptions TokenJson = new(JsonSerializerDefaults.Web) { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };
    private static readonly JsonSerializerOptions DriveJson = new(JsonSerializerDefaults.Web);

    public async Task<GoogleSignIn> SignInAsync(GoogleClient client, string code, string codeVerifier, string redirectUri, CancellationToken cancellation)
    {
        var tokens = await TokenAsync(client, new() { ["grant_type"] = "authorization_code", ["code"] = code, ["code_verifier"] = codeVerifier, ["redirect_uri"] = redirectUri }, cancellation);

        if (string.IsNullOrEmpty(tokens.RefreshToken))
            throw new GoogleRequestException(400, "Google gave no refresh token: remove PowerLoom's access at myaccount.google.com/permissions, then sign in again.");

        return new GoogleSignIn(tokens.RefreshToken, EmailOf(tokens.IdToken));
    }

    public async Task<DriveItem?> GetItemAsync(GoogleClient client, string refreshToken, string id, CancellationToken cancellation)
    {
        var tokens = await TokenAsync(client, new() { ["grant_type"] = "refresh_token", ["refresh_token"] = refreshToken }, cancellation);
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{FilesUrl}/{Uri.EscapeDataString(id)}?fields=id,name,mimeType&supportsAllDrives=true");

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);

        using var response = await Http().SendAsync(request, cancellation);

        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;

        await EnsureSuccessAsync(response, cancellation);

        var file = await response.Content.ReadFromJsonAsync<FileDto>(DriveJson, cancellation);

        return file is null ? null : new DriveItem(file.Id, file.Name, file.MimeType == FolderType);
    }

    private async Task<TokenDto> TokenAsync(GoogleClient client, Dictionary<string, string> grant, CancellationToken cancellation)
    {
        grant["client_id"] = client.Id;
        grant["client_secret"] = client.Secret;

        using var response = await Http().PostAsync(TokenUrl, new FormUrlEncodedContent(grant), cancellation);

        await EnsureSuccessAsync(response, cancellation);

        return await response.Content.ReadFromJsonAsync<TokenDto>(TokenJson, cancellation) ?? throw new GoogleRequestException(502, "Google returned an empty answer");
    }

    // The account's email from the sign-in's ID token (scope `email`); read only for the page, so not verified here.
    private static string EmailOf(string? idToken)
    {
        var payload = idToken?.Split('.').ElementAtOrDefault(1);

        if (string.IsNullOrEmpty(payload))
            return "";

        var padded = payload.Replace('-', '+').Replace('_', '/').PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');

        return JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(padded))).RootElement.TryGetProperty("email", out var email) ? email.GetString() ?? "" : "";
    }

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellation)
    {
        if (response.IsSuccessStatusCode)
            return;

        var text = await response.Content.ReadAsStringAsync(cancellation);

        throw new GoogleRequestException((int)response.StatusCode, $"Google answered {(int)response.StatusCode}: {(text.Length > 300 ? text[..300] : text)}");
    }

    private HttpClient Http() => httpClients.CreateClient(GoogleDriveIntegrationSetup.HttpClientName);

    private sealed record TokenDto(string AccessToken, string? RefreshToken, string? IdToken);

    private sealed record FileDto(string Id, string Name, string MimeType);
}
