using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Configurations;

public partial class WorkItemConfiguration : IEntityTypeConfiguration<WorkItem>
{
    public void Configure(EntityTypeBuilder<WorkItem> entity)
    {
        entity.HasKey(e => e.AdoId).HasName("work_item_pkey");

        entity.ToTable("work_item");

        entity.HasIndex(e => e.PipelineStatus, "work_item_pipeline_status_idx");

        entity.HasIndex(e => e.IterationPath, "work_item_iteration_idx");

        entity.HasIndex(e => e.ParentId, "work_item_parent_idx");

        entity.Property(e => e.AdoId)
            .ValueGeneratedNever()
            .HasColumnName("ado_id");
        entity.Property(e => e.AcceptanceCriteriaMd).HasColumnName("acceptance_criteria_md");
        entity.Property(e => e.AdoChangedAt).HasColumnName("ado_changed_at");
        entity.Property(e => e.AdoState).HasColumnName("ado_state");
        entity.Property(e => e.AreaPath).HasColumnName("area_path");
        entity.Property(e => e.AssignedTo).HasColumnName("assigned_to");
        entity.Property(e => e.BacklogPriority).HasColumnName("backlog_priority");
        entity.Property(e => e.ConfluencePages)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("confluence_pages");
        entity.Property(e => e.ContentHash).HasColumnName("content_hash");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.DescriptionMd).HasColumnName("description_md");
        entity.Property(e => e.DiscussionMd).HasColumnName("discussion_md");
        entity.Property(e => e.ExtraFieldsMd).HasColumnName("extra_fields_md");
        entity.Property(e => e.DiscussionRev).HasColumnName("discussion_rev");
        entity.Property(e => e.Effort).HasColumnName("effort");
        entity.Property(e => e.IterationPath).HasColumnName("iteration_path");
        entity.Property(e => e.ParentId).HasColumnName("parent_id");
        entity.Property(e => e.Priority).HasColumnName("priority");
        entity.Property(e => e.RemainingWork).HasColumnName("remaining_work");
        entity.Property(e => e.Rev).HasColumnName("rev");
        entity.Property(e => e.Skills)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("skills");
        entity.Property(e => e.SkillsEditedAt).HasColumnName("skills_edited_at");
        entity.Property(e => e.SyncedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("synced_at");
        entity.Property(e => e.Tags).HasColumnName("tags");
        entity.Property(e => e.Title).HasColumnName("title");
        entity.Property(e => e.Type).HasColumnName("type");
        entity.Property(e => e.Vault).HasColumnName("vault");
        entity.Property(e => e.VaultPath).HasColumnName("vault_path");

        entity.HasOne(d => d.Parent).WithMany(p => p.InverseParent)
            .HasForeignKey(d => d.ParentId)
            .HasConstraintName("work_item_parent_id_work_item_ado_id_fk");

        entity.HasOne(d => d.VaultNavigation).WithMany(p => p.WorkItems)
            .HasForeignKey(d => d.Vault)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("work_item_vault_vault_name_fk");

        entity.Property(e => e.PipelineStatus)
            .HasDefaultValueSql("'new'::pipeline_status")
            .HasColumnName("pipeline_status");
        entity.Property(e => e.Source)
            .HasDefaultValueSql("'ado'::work_item_source")
            .HasColumnName("source");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<WorkItem> entity);
}
