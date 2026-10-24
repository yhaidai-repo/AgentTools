using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Configurations;

public partial class PbiRepoConfiguration : IEntityTypeConfiguration<PbiRepo>
{
    public void Configure(EntityTypeBuilder<PbiRepo> entity)
    {
        entity.HasKey(e => new { e.PbiId, e.RepoId }).HasName("pbi_repo_pbi_id_repo_id_pk");

        entity.ToTable("pbi_repo");

        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.RepoId).HasColumnName("repo_id");
        entity.Property(e => e.QuestionId).HasColumnName("question_id");

        entity.HasOne(d => d.Pbi).WithMany(p => p.PbiRepos)
            .HasForeignKey(d => d.PbiId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("pbi_repo_pbi_id_work_item_ado_id_fk");

        entity.HasOne(d => d.Question).WithMany(p => p.PbiRepos)
            .HasForeignKey(d => d.QuestionId)
            .HasConstraintName("pbi_repo_question_id_local_item_id_fk");

        entity.HasOne(d => d.Repo).WithMany(p => p.PbiRepos)
            .HasForeignKey(d => d.RepoId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("pbi_repo_repo_id_repo_id_fk");

        entity.Property(e => e.Source).HasColumnName("source");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<PbiRepo> entity);
}
