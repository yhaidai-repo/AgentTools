using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class VaultConfiguration : IEntityTypeConfiguration<Vault>
{
    public void Configure(EntityTypeBuilder<Vault> entity)
    {
        entity.HasKey(e => e.Name).HasName("vault_pkey");

        entity.ToTable("vault");

        entity.Property(e => e.Name).HasColumnName("name");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.Features)
            .HasColumnType("jsonb")
            .HasColumnName("features");
        entity.Property(e => e.ImportFolder).HasColumnName("import_folder");
        entity.Property(e => e.RemovedAt).HasColumnName("removed_at");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<Vault> entity);
}
