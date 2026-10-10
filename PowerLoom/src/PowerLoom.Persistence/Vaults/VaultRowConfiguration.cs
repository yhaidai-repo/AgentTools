using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace PowerLoom.Persistence.Vaults;

public sealed class VaultRowConfiguration : IEntityTypeConfiguration<VaultRow>
{
    public void Configure(EntityTypeBuilder<VaultRow> builder)
    {
        builder.ToTable("vault");
        builder.HasKey(vault => vault.Name);
        builder.Property(vault => vault.Name).HasColumnName("name");
        builder.Property(vault => vault.Features).HasColumnName("features").HasColumnType("jsonb");
        builder.Property(vault => vault.ImportFolder).HasColumnName("import_folder");
        builder.Property(vault => vault.RemovedAt).HasColumnName("removed_at");
        builder.Property(vault => vault.CreatedAt).HasColumnName("created_at");
    }
}
