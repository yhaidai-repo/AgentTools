namespace PowerLoom.GoogleDriveIntegration.Features.Connection.Models;

// The sign-in's answer as the web's callback got it: the code, the PKCE verifier the sign-in started with, and the
// redirect address Google sent the browser to.
public sealed record GoogleSignInRequest(string Code, string CodeVerifier, string RedirectUri);
