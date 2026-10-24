using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class TestCaseConfiguration : IEntityTypeConfiguration<TestCase>
{
    public void Configure(EntityTypeBuilder<TestCase> entity)
    {
        entity.HasKey(e => new { e.PbiId, e.AdoId }).HasName("test_case_pbi_id_ado_id_pk");

        entity.ToTable("test_case");

        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.AdoId).HasColumnName("ado_id");
        entity.Property(e => e.Title).HasColumnName("title");
        entity.Property(e => e.State).HasColumnName("state");
        entity.Property(e => e.Priority).HasColumnName("priority");
        entity.Property(e => e.Rev).HasColumnName("rev");
        entity.Property(e => e.StepsMd).HasColumnName("steps_md");
        entity.Property(e => e.Parameters).HasColumnName("parameters");
        entity.Property(e => e.FetchedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("fetched_at");

        entity.HasOne(d => d.Pbi).WithMany()
            .HasForeignKey(d => d.PbiId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("test_case_pbi_id_work_item_ado_id_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<TestCase> entity);
}
