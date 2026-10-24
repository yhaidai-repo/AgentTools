using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class CodeReviewVersionConfiguration : IEntityTypeConfiguration<CodeReviewVersion>
{
    public void Configure(EntityTypeBuilder<CodeReviewVersion> entity)
    {
        entity.HasKey(e => e.Id).HasName("code_review_version_pkey");

        entity.ToTable("code_review_version");

        entity.HasIndex(e => new { e.PrId, e.CreatedAt }, "code_review_version_pr_idx");
        entity.HasIndex(e => e.RunId, "code_review_version_run_uq").IsUnique();

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.PrId).HasColumnName("pr_id");
        entity.Property(e => e.RunId).HasColumnName("run_id");
        entity.Property(e => e.ReviewedCommit).HasColumnName("reviewed_commit");
        entity.Property(e => e.ReviewedIteration).HasColumnName("reviewed_iteration");
        entity.Property(e => e.SummaryMd).HasColumnName("summary_md");
        entity.Property(e => e.Details)
            .HasColumnType("jsonb")
            .HasColumnName("details");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");

        entity.HasOne(d => d.Pr).WithMany()
            .HasForeignKey(d => d.PrId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("code_review_version_pr_id_pull_request_id_fk");

        entity.HasOne(d => d.Run).WithMany()
            .HasForeignKey(d => d.RunId)
            .OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("code_review_version_run_id_agent_run_id_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<CodeReviewVersion> entity);
}
