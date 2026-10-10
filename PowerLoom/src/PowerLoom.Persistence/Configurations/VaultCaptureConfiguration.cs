using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class VaultCaptureConfiguration : IEntityTypeConfiguration<VaultCapture>
{
    public void Configure(EntityTypeBuilder<VaultCapture> entity)
    {
        entity.HasKey(e => e.Id).HasName("vault_capture_pkey");

        entity.ToTable("vault_capture");

        entity.HasIndex(e => e.PbiId, "vault_capture_pbi_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.Assumptions)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("assumptions");
        entity.Property(e => e.Captured)
            .HasColumnType("jsonb")
            .HasColumnName("captured");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.Errors)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("errors");
        entity.Property(e => e.FilePath).HasColumnName("file_path");
        entity.Property(e => e.ItemId).HasColumnName("item_id");
        entity.Property(e => e.Name).HasColumnName("name");
        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.Project).HasColumnName("project");
        entity.Property(e => e.RunId).HasColumnName("run_id");
        entity.Property(e => e.Status)
            .HasDefaultValueSql("'pending'::text")
            .HasColumnName("status");
        entity.Property(e => e.Target).HasColumnName("target");
        entity.Property(e => e.Title).HasColumnName("title");
        entity.Property(e => e.ToFill)
            .HasColumnType("jsonb")
            .HasColumnName("to_fill");

        entity.HasOne(d => d.Item).WithMany(p => p.VaultCaptures)
            .HasForeignKey(d => d.ItemId)
            .HasConstraintName("vault_capture_item_id_local_item_id_fk");

        entity.HasOne(d => d.Pbi).WithMany(p => p.VaultCaptures)
            .HasForeignKey(d => d.PbiId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("vault_capture_pbi_id_work_item_ado_id_fk");

        entity.HasOne(d => d.Run).WithMany(p => p.VaultCaptures)
            .HasForeignKey(d => d.RunId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("vault_capture_run_id_agent_run_id_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<VaultCapture> entity);
}
