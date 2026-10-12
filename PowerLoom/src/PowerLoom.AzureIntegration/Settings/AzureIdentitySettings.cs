namespace PowerLoom.AzureIntegration.Settings;

// The vault's Entra app registration (service principal) with a client secret (user decision 2026-10-12). An Azure
// admin assigns it the read-only roles; the secret expires and is replaced here by hand.
public sealed class AzureIdentitySettings
{
    public string TenantId { get; set; } = "";

    public string ClientId { get; set; } = "";

    // Stored in the database, never shown again (like the ADO token).
    public string ClientSecret { get; set; } = "";
}
