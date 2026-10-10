using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class SkillRevisionConfiguration : IEntityTypeConfiguration<SkillRevision>
{
    public void Configure(EntityTypeBuilder<SkillRevision> entity)
    {
        entity.HasKey(e => e.Id).HasName("skill_revision_pkey");

        entity.ToTable("skill_revision");

        entity.HasIndex(e => new { e.Name, e.CreatedAt }, "skill_revision_name_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.Content).HasColumnName("content");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.Folder).HasColumnName("folder");
        entity.Property(e => e.Name).HasColumnName("name");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<SkillRevision> entity);
}
