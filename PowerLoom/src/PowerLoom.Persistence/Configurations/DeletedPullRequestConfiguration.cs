using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class DeletedPullRequestConfiguration : IEntityTypeConfiguration<DeletedPullRequest>
{
    public void Configure(EntityTypeBuilder<DeletedPullRequest> entity)
    {
        entity.HasKey(e => e.Id).HasName("deleted_pull_request_pkey");

        entity.ToTable("deleted_pull_request");

        entity.Property(e => e.Id)
            .ValueGeneratedNever()
            .HasColumnName("id");
        entity.Property(e => e.DeletedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("deleted_at");
        entity.Property(e => e.Title).HasColumnName("title");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<DeletedPullRequest> entity);
}
