using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Configurations;

public partial class BugConfiguration : IEntityTypeConfiguration<Bug>
{
    public void Configure(EntityTypeBuilder<Bug> entity)
    {
        entity.HasKey(e => e.WorkItemId).HasName("bug_pkey");

        entity.ToTable("bug");

        entity.HasIndex(e => e.PbiId, "bug_pbi_idx");

        entity.Property(e => e.WorkItemId)
            .ValueGeneratedNever()
            .HasColumnName("work_item_id");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.ReportedBy).HasColumnName("reported_by");

        entity.HasOne(d => d.Pbi).WithMany(p => p.BugPbis)
            .HasForeignKey(d => d.PbiId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("bug_pbi_id_work_item_ado_id_fk");

        entity.HasOne(d => d.WorkItem).WithOne(p => p.BugWorkItem)
            .HasForeignKey<Bug>(d => d.WorkItemId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("bug_work_item_id_work_item_ado_id_fk");

        entity.Property(e => e.FoundIn).HasColumnName("found_in");
        entity.Property(e => e.Source).HasColumnName("source");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<Bug> entity);
}
