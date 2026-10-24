namespace PowerLoom.Api.Tests;

// One API host and one Postgres for the whole run: the host's settings are process-wide environment variables, so two
// hosts in parallel would overwrite each other's.
[CollectionDefinition(Name)]
public sealed class PowerLoomCollection : ICollectionFixture<PowerLoomHost>
{
    public const string Name = "PowerLoom host";
}
