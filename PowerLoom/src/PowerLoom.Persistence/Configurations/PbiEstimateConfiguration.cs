using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class PbiEstimateConfiguration : IEntityTypeConfiguration<PbiEstimate>
{
    public void Configure(EntityTypeBuilder<PbiEstimate> entity)
    {
        entity.HasKey(e => e.Id).HasName("pbi_estimate_pkey");

        entity.ToTable("pbi_estimate", table => table.HasCheckConstraint("pbi_estimate_complexity_ck", "complexity >= 1 AND complexity <= 5"));

        entity.HasIndex(e => new { e.PbiId, e.CreatedAt }, "pbi_estimate_pbi_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.RunId).HasColumnName("run_id");
        entity.Property(e => e.Agent).HasColumnName("agent");
        entity.Property(e => e.HumanHours).HasColumnName("human_hours");
        entity.Property(e => e.AgentHours).HasColumnName("agent_hours");
        entity.Property(e => e.Complexity).HasColumnName("complexity");
        entity.Property(e => e.Confidence).HasColumnName("confidence");
        entity.Property(e => e.Basis).HasColumnName("basis");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");

        entity.HasOne(d => d.Pbi).WithMany()
            .HasForeignKey(d => d.PbiId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("pbi_estimate_pbi_id_work_item_ado_id_fk");

        entity.HasOne(d => d.Run).WithMany()
            .HasForeignKey(d => d.RunId)
            .OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("pbi_estimate_run_id_agent_run_id_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<PbiEstimate> entity);
}
