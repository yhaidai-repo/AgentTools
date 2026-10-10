using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class DesignConfiguration : IEntityTypeConfiguration<Design>
{
    public void Configure(EntityTypeBuilder<Design> entity)
    {
        entity.HasKey(e => e.Id).HasName("design_pkey");

        entity.ToTable("design", table => table.HasCheckConstraint("design_complexity_ck", "complexity >= 1 AND complexity <= 5"));

        entity.HasIndex(e => new { e.PbiId, e.Version }, "design_pbi_version_uq").IsUnique();

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.Alternatives)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("alternatives");
        entity.Property(e => e.Approach)
            .HasDefaultValueSql("''::text")
            .HasColumnName("approach");
        entity.Property(e => e.Assumptions)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("assumptions");
        entity.Property(e => e.Complexity).HasColumnName("complexity");
        entity.Property(e => e.Confidence).HasColumnName("confidence");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.EstAgentH).HasColumnName("est_agent_h");
        entity.Property(e => e.EstHumanH).HasColumnName("est_human_h");
        entity.Property(e => e.EstimateBasis)
            .HasDefaultValueSql("''::text")
            .HasColumnName("estimate_basis");
        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.Plan)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("plan");
        entity.Property(e => e.RiskCount)
            .HasDefaultValueSql("0")
            .HasColumnName("risk_count");
        entity.Property(e => e.Risks)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("risks");
        entity.Property(e => e.RunId).HasColumnName("run_id");
        entity.Property(e => e.TestCount)
            .HasDefaultValueSql("0")
            .HasColumnName("test_count");
        entity.Property(e => e.Tests)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("tests");
        entity.Property(e => e.Version).HasColumnName("version");

        entity.HasOne(d => d.Pbi).WithMany(p => p.Designs)
            .HasForeignKey(d => d.PbiId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("design_pbi_id_work_item_ado_id_fk");

        entity.HasOne(d => d.Run).WithMany(p => p.Designs)
            .HasForeignKey(d => d.RunId)
            .HasConstraintName("design_run_id_agent_run_id_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<Design> entity);
}
