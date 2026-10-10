using Microsoft.EntityFrameworkCore;
using PowerLoom.Persistence.Vaults;

namespace PowerLoom.Persistence;

// Maps adoa's existing tables (drizzle owns the schema until phase 1 of the delivery plan hands it to PowerLoom).
public sealed class PowerLoomDbContext(DbContextOptions<PowerLoomDbContext> options) : DbContext(options)
{
    public DbSet<VaultRow> Vaults => Set<VaultRow>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(PowerLoomDbContext).Assembly);
    }
}
