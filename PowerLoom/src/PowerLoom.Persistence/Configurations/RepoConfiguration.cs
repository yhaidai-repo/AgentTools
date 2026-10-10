using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Configurations;

public partial class RepoConfiguration : IEntityTypeConfiguration<Repo>
{
    public void Configure(EntityTypeBuilder<Repo> entity)
    {
        entity.HasKey(e => e.Id).HasName("repo_pkey");

        entity.ToTable("repo");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.AdoProject).HasColumnName("ado_project");
        entity.Property(e => e.DefaultBranch).HasColumnName("default_branch");
        entity.Property(e => e.Excluded)
            .HasDefaultValueSql("false")
            .HasColumnName("excluded");
        entity.Property(e => e.Name).HasColumnName("name");
        entity.Property(e => e.RemoteUrl).HasColumnName("remote_url");
        entity.Property(e => e.Summary).HasColumnName("summary");
        entity.Property(e => e.SyncedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("synced_at");
        entity.Property(e => e.Vault).HasColumnName("vault");

        entity.HasOne(d => d.VaultNavigation).WithMany(p => p.Repos)
            .HasForeignKey(d => d.Vault)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("repo_vault_vault_name_fk");

        entity.Property(e => e.Kind)
            .HasDefaultValueSql("'ado'::repo_kind")
            .HasColumnName("kind");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<Repo> entity);
}
