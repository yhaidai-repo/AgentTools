using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class PullRequestConfiguration : IEntityTypeConfiguration<PullRequest>
{
    public void Configure(EntityTypeBuilder<PullRequest> entity)
    {
        entity.HasKey(e => e.Id).HasName("pull_request_pkey");

        entity.ToTable("pull_request");

        entity.Property(e => e.Id)
            .ValueGeneratedNever()
            .HasColumnName("id");
        entity.Property(e => e.AdoCreatedAt).HasColumnName("ado_created_at");
        entity.Property(e => e.Author).HasColumnName("author");
        entity.Property(e => e.DescriptionMd).HasColumnName("description_md");
        entity.Property(e => e.IsDraft)
            .HasDefaultValueSql("false")
            .HasColumnName("is_draft");
        entity.Property(e => e.IsListed)
            .HasDefaultValue(true)
            .HasColumnName("is_listed");
        entity.Property(e => e.Iteration)
            .HasDefaultValue(1)
            .HasColumnName("iteration");
        entity.Property(e => e.RepoId).HasColumnName("repo_id");
        entity.Property(e => e.RepoName).HasColumnName("repo_name");
        entity.Property(e => e.SourceCommit).HasColumnName("source_commit");
        entity.Property(e => e.SourceRef).HasColumnName("source_ref");
        entity.Property(e => e.SyncedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("synced_at");
        entity.Property(e => e.TargetCommit).HasColumnName("target_commit");
        entity.Property(e => e.TargetRef).HasColumnName("target_ref");
        entity.Property(e => e.Title).HasColumnName("title");
        entity.Property(e => e.Url).HasColumnName("url");
        entity.Property(e => e.Vault).HasColumnName("vault");
        entity.Property(e => e.Origin)
            .HasDefaultValue("sync")
            .HasColumnName("origin");
        entity.Property(e => e.WorkItemIds)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("work_item_ids");

        entity.HasOne(d => d.VaultNavigation).WithMany(p => p.PullRequests)
            .HasForeignKey(d => d.Vault)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("pull_request_vault_vault_name_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<PullRequest> entity);
}
