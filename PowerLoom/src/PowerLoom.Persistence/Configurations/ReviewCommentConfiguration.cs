using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Configurations;

public partial class ReviewCommentConfiguration : IEntityTypeConfiguration<ReviewComment>
{
    public void Configure(EntityTypeBuilder<ReviewComment> entity)
    {
        entity.HasKey(e => e.Id).HasName("review_comment_pkey");

        entity.ToTable("review_comment");

        entity.HasIndex(e => new { e.PrId, e.Status }, "review_comment_pr_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.AgentReplyMd).HasColumnName("agent_reply_md");
        entity.Property(e => e.AnswerMd).HasColumnName("answer_md");
        entity.Property(e => e.AnsweredAt).HasColumnName("answered_at");
        entity.Property(e => e.BodyMd).HasColumnName("body_md");
        entity.Property(e => e.Category).HasColumnName("category");
        entity.Property(e => e.CodeSnippet).HasColumnName("code_snippet");
        entity.Property(e => e.Commit).HasColumnName("commit");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.EndLine).HasColumnName("end_line");
        entity.Property(e => e.FilePath).HasColumnName("file_path");
        entity.Property(e => e.PrId).HasColumnName("pr_id");
        entity.Property(e => e.RunId).HasColumnName("run_id");
        entity.Property(e => e.SnippetStartLine).HasColumnName("snippet_start_line");
        entity.Property(e => e.StartLine).HasColumnName("start_line");
        entity.Property(e => e.UpdatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("updated_at");

        entity.HasOne(d => d.Pr).WithMany(p => p.ReviewComments)
            .HasForeignKey(d => d.PrId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("review_comment_pr_id_pull_request_id_fk");

        entity.HasOne(d => d.Run).WithMany(p => p.ReviewComments)
            .HasForeignKey(d => d.RunId)
            .HasConstraintName("review_comment_run_id_agent_run_id_fk");

        entity.Property(e => e.Severity).HasColumnName("severity");
        entity.Property(e => e.Status)
            .HasDefaultValueSql("'open'::review_comment_status")
            .HasColumnName("status");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<ReviewComment> entity);
}
