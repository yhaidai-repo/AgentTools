using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Configurations;

public partial class CodeReviewConfiguration : IEntityTypeConfiguration<CodeReview>
{
    public void Configure(EntityTypeBuilder<CodeReview> entity)
    {
        entity.HasKey(e => e.PrId).HasName("code_review_pkey");

        entity.ToTable("code_review");

        entity.Property(e => e.PrId)
            .ValueGeneratedNever()
            .HasColumnName("pr_id");
        entity.Property(e => e.ClosedReason).HasColumnName("closed_reason");
        entity.Property(e => e.Details)
            .HasColumnType("jsonb")
            .HasColumnName("details");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.ReviewedAt).HasColumnName("reviewed_at");
        entity.Property(e => e.ReviewedCommit).HasColumnName("reviewed_commit");
        entity.Property(e => e.ReviewedIteration).HasColumnName("reviewed_iteration");
        entity.Property(e => e.SummaryMd).HasColumnName("summary_md");
        entity.Property(e => e.UpdatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("updated_at");

        entity.HasOne(d => d.Pr).WithOne(p => p.CodeReview)
            .HasForeignKey<CodeReview>(d => d.PrId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("code_review_pr_id_pull_request_id_fk");

        entity.Property(e => e.Status)
            .HasDefaultValueSql("'active'::review_status")
            .HasColumnName("status");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<CodeReview> entity);
}
