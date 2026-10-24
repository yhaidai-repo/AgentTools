using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Configurations;

public partial class VaultNoteWriteConfiguration : IEntityTypeConfiguration<VaultNoteWrite>
{
    public void Configure(EntityTypeBuilder<VaultNoteWrite> entity)
    {
        entity.HasKey(e => e.Id).HasName("vault_note_write_pkey");

        entity.ToTable("vault_note_write");

        entity.HasIndex(e => e.Path, "vault_note_write_path_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.Path).HasColumnName("path");
        entity.Property(e => e.RunId).HasColumnName("run_id");
        entity.Property(e => e.Vault).HasColumnName("vault");
        entity.Property(e => e.WrittenAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("written_at");

        entity.HasOne(d => d.VaultNavigation).WithMany(p => p.VaultNoteWrites)
            .HasForeignKey(d => d.Vault)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("vault_note_write_vault_vault_name_fk");

        entity.Property(e => e.Action).HasColumnName("action");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<VaultNoteWrite> entity);
}
