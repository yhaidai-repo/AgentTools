using System.Net.Http.Headers;
using System.Text;
using System.Text.RegularExpressions;
using DevSecrets.DevHub.Models;

namespace DevSecrets.DevHub.Browser;

// An agent's API call that needs a key (user request 2026-10-20: the API cases of a test): DevHub fills the
// `{{secret:<name>}}` placeholders and sends the request from the host, where the local services and Azure dev are
// reachable; the answer comes back with every known secret redacted. Local dev certificates are accepted.
public sealed partial class SecretHttpClient(SecretsFile secrets) : IDisposable
{
    private const int MaxBodyChars = 60_000;
    private const string Redacted = "<secret>";
    private static readonly string[] ForwardedResponseHeaders = ["Content-Type", "Location", "WWW-Authenticate"];
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(90);

    private readonly HttpClient _http = new(new HttpClientHandler { ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator }) { Timeout = Timeout };

    public async Task<HubResult<SecretHttpResponse>> SendAsync(SecretHttpRequest request, CancellationToken cancellationToken)
    {
        var values = secrets.AllValues();
        var missing = MissingNames(request, values);

        if (missing.Length > 0)
            return HubResult<SecretHttpResponse>.From(HubResult.NotFound($"No dev-secrets value named {string.Join(", ", missing)}."));

        if (!Uri.TryCreate(Fill(request.Url, values), UriKind.Absolute, out var url))
            return HubResult<SecretHttpResponse>.From(HubResult.Invalid($"Not an absolute URL: {request.Url}"));

        using var message = Build(request, url, values);
        using var response = await _http.SendAsync(message, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        var body = Redact(await response.Content.ReadAsStringAsync(cancellationToken), values);

        return HubResult<SecretHttpResponse>.Ok(new SecretHttpResponse((int)response.StatusCode, HeadersOf(response), body[..Math.Min(body.Length, MaxBodyChars)], body.Length > MaxBodyChars));
    }

    public void Dispose() => _http.Dispose();

    private static HttpRequestMessage Build(SecretHttpRequest request, Uri url, IReadOnlyDictionary<string, string> values)
    {
        var message = new HttpRequestMessage(new HttpMethod(request.Method.ToUpperInvariant()), url);

        foreach (var (name, value) in request.Headers ?? [])
            message.Headers.TryAddWithoutValidation(name, Fill(value, values));

        if (request.Body is not null)
            message.Content = new StringContent(Fill(request.Body, values), Encoding.UTF8, request.ContentType ?? "application/json");

        return message;
    }

    private static string[] MissingNames(SecretHttpRequest request, IReadOnlyDictionary<string, string> values)
    {
        var texts = new[] { request.Url, request.Body ?? "" }.Concat(request.Headers?.Values ?? Enumerable.Empty<string>());

        return texts.SelectMany(text => Placeholder().Matches(text).Select(match => match.Groups[1].Value)).Distinct().Where(name => !values.ContainsKey(name)).ToArray();
    }

    // `{{secret:name}}` is the value; `{{secret:name|basic}}` is a Basic authorization value with the secret as the
    // password (how the PVS API takes its key).
    private static string Fill(string text, IReadOnlyDictionary<string, string> values) =>
        Placeholder().Replace(text, match => values.TryGetValue(match.Groups[1].Value, out var value) ? Transform(value, match.Groups[2].Value) : match.Value);

    private static string Transform(string value, string form) => form == "basic" ? "Basic " + BasicToken(value) : value;

    // A value that already is a Basic token (base64 of user:password, as some keys are stored) goes as it is; a raw
    // key becomes the password of an empty user (how the PVS API reads it).
    private static string BasicToken(string value) =>
        IsBasicToken(value) ? value : Convert.ToBase64String(Latin1.GetBytes(":" + value));

    private static bool IsBasicToken(string value)
    {
        try
        {
            return Latin1.GetString(Convert.FromBase64String(value)).Contains(':');
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static readonly Encoding Latin1 = Encoding.GetEncoding("iso-8859-1");

    // Every known value of 4+ characters: a page or an API echoing a key must not reach the agent.
    private static string Redact(string text, IReadOnlyDictionary<string, string> values)
    {
        foreach (var value in values.Values.Where(value => value.Length >= 4))
            text = text.Replace(value, Redacted, StringComparison.Ordinal);

        return text;
    }

    private static Dictionary<string, string> HeadersOf(HttpResponseMessage response)
    {
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var name in ForwardedResponseHeaders)
        {
            if (response.Headers.TryGetValues(name, out var values) || response.Content.Headers.TryGetValues(name, out values))
                headers[name] = string.Join(", ", values);
        }

        return headers;
    }

    [GeneratedRegex(@"\{\{secret:([A-Za-z0-9._-]+)(?:\|(basic))?\}\}")]
    private static partial Regex Placeholder();
}
