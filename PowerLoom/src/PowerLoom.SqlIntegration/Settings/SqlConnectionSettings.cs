namespace PowerLoom.SqlIntegration.Settings;

public sealed class SqlConnectionSettings
{
    // What agents pick the connection by: letters, digits, `_` and `-`.
    public string Name { get; set; } = "";

    // Taken from the connection string when it is saved, so the Settings page can show them without the string.
    public string Server { get; set; } = "";

    public string Database { get; set; } = "";

    // Stored in the database, never shown again (like the ADO token).
    public string ConnectionString { get; set; } = "";

    public bool Enabled { get; set; } = true;
}
