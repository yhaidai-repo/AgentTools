using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Configurations;

public partial class VaultReviewDecisionConfiguration : IEntityTypeConfiguration<VaultReviewDecision>
{
    public void Configure(EntityTypeBuilder<VaultReviewDecision> entity)
    {
        entity.HasKey(e => e.Id).HasName("vault_review_decision_pkey");

        entity.ToTable("vault_review_decision");

        entity.HasIndex(e => new { e.Vault, e.Path }, "vault_review_decision_note_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.DecidedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("decided_at");
        entity.Property(e => e.NoteMtime).HasColumnName("note_mtime");
        entity.Property(e => e.Path).HasColumnName("path");
        entity.Property(e => e.Reasons).HasColumnName("reasons");
        entity.Property(e => e.RecordId).HasColumnName("record_id");
        entity.Property(e => e.RunId).HasColumnName("run_id");
        entity.Property(e => e.TaskId).HasColumnName("task_id");
        entity.Property(e => e.Vault).HasColumnName("vault");

        entity.Property(e => e.Action).HasColumnName("action");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<VaultReviewDecision> entity);
}
