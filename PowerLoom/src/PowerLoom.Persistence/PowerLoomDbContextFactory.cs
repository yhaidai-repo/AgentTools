using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PowerLoom.Persistence;

// For `dotnet ef` only (migrations add / script): no host, the connection string from the environment.
public sealed class PowerLoomDbContextFactory : IDesignTimeDbContextFactory<PowerLoomDbContext>
{
    private const string ConnectionSetting = "ConnectionStrings__PowerLoom";

    public PowerLoomDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable(ConnectionSetting) ?? "Host=localhost;Database=powerloom";
        var options = new DbContextOptionsBuilder<PowerLoomDbContext>().UseNpgsql(connectionString, npgsql => npgsql.MapPowerLoomEnums()).Options;

        return new PowerLoomDbContext(options);
    }
}
