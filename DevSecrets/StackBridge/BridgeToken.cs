using System.Security.Cryptography;
using System.Text;
using DevSecrets.StackBridge.Models;
using Microsoft.Extensions.Options;

namespace DevSecrets.StackBridge;

// Every call except /health and the UI's entry needs "Authorization: Bearer <token>".
public static class BridgeToken
{
    private const string Scheme = "Bearer ";

    public static WebApplication UseBridgeToken(this WebApplication app)
    {
        var token = Encoding.UTF8.GetBytes(app.Services.GetRequiredService<IOptions<StackBridgeOptions>>().Value.Token);

        app.Use(async (context, next) =>
        {
            if (IsPublic(context.Request) || HasToken(context.Request, token))
            {
                await next(context);

                return;
            }

            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        });

        return app;
    }

    private static bool IsPublic(HttpRequest request) => request.Path == StackEndpoints.HealthPath || request.Path == "/";

    private static bool HasToken(HttpRequest request, byte[] token)
    {
        var header = request.Headers.Authorization.ToString();

        if (!header.StartsWith(Scheme, StringComparison.Ordinal))
            return false;

        return CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(header[Scheme.Length..]), token);
    }
}
