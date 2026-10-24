using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class PbiImportConfiguration : IEntityTypeConfiguration<PbiImport>
{
    public void Configure(EntityTypeBuilder<PbiImport> entity)
    {
        entity.HasKey(e => e.Id).HasName("pbi_import_pkey");

        entity.ToTable("pbi_import");

        entity.HasIndex(e => new { e.Source, e.SourceRef }, "pbi_import_source_ref_uq").IsUnique();

        entity.HasIndex(e => e.UpdatedAt, "pbi_import_updated_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.OccurredAt).HasColumnName("occurred_at");
        entity.Property(e => e.Results)
            .HasColumnType("jsonb")
            .HasColumnName("results");
        entity.Property(e => e.Sender).HasColumnName("sender");
        entity.Property(e => e.Source).HasColumnName("source");
        entity.Property(e => e.SourceRef).HasColumnName("source_ref");
        entity.Property(e => e.Title).HasColumnName("title");
        entity.Property(e => e.UpdatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("updated_at");
        entity.Property(e => e.Vault).HasColumnName("vault");

        entity.HasOne(d => d.VaultNavigation).WithMany(p => p.PbiImports)
            .HasForeignKey(d => d.Vault)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("pbi_import_vault_vault_name_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<PbiImport> entity);
}
