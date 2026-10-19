using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Configurations;

public partial class LocalItemConfiguration : IEntityTypeConfiguration<LocalItem>
{
    public void Configure(EntityTypeBuilder<LocalItem> entity)
    {
        entity.HasKey(e => e.Id).HasName("local_item_pkey");

        entity.ToTable("local_item");

        entity.HasIndex(e => new { e.Kind, e.Status }, "local_item_kind_status_idx");

        entity.HasIndex(e => new { e.PbiId, e.Status }, "local_item_pbi_status_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.Assignee).HasColumnName("assignee");
        entity.Property(e => e.Attempts)
            .HasDefaultValueSql("0")
            .HasColumnName("attempts");
        entity.Property(e => e.Body).HasColumnName("body");
        entity.Property(e => e.ClosedAt).HasColumnName("closed_at");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.CreatedByRun).HasColumnName("created_by_run");
        entity.Property(e => e.Data)
            .HasColumnType("jsonb")
            .HasColumnName("data");
        entity.Property(e => e.HandedOnAt).HasColumnName("handed_on_at");
        entity.Property(e => e.HeldBy)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("held_by");
        entity.Property(e => e.ParentId).HasColumnName("parent_id");
        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.Resolution).HasColumnName("resolution");
        entity.Property(e => e.StartOver)
            .HasDefaultValue(false)
            .HasColumnName("start_over");
        entity.Property(e => e.Title).HasColumnName("title");
        entity.Property(e => e.UpdatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("updated_at");
        entity.Property(e => e.Vault).HasColumnName("vault");
        entity.Property(e => e.VaultPath).HasColumnName("vault_path");

        entity.HasOne(d => d.CreatedByRunNavigation).WithMany(p => p.LocalItems)
            .HasForeignKey(d => d.CreatedByRun)
            .HasConstraintName("local_item_created_by_run_agent_run_id_fk");

        entity.HasOne(d => d.Parent).WithMany(p => p.InverseParent)
            .HasForeignKey(d => d.ParentId)
            .HasConstraintName("local_item_parent_id_local_item_id_fk");

        entity.HasOne(d => d.Pbi).WithMany(p => p.LocalItems)
            .HasForeignKey(d => d.PbiId)
            .HasConstraintName("local_item_pbi_id_work_item_ado_id_fk");

        entity.HasOne(d => d.VaultNavigation).WithMany(p => p.LocalItems)
            .HasForeignKey(d => d.Vault)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("local_item_vault_vault_name_fk");

        entity.Property(e => e.Kind).HasColumnName("kind");
        entity.Property(e => e.Status).HasColumnName("status");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<LocalItem> entity);
}
