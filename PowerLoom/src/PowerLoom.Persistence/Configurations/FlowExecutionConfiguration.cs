using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class FlowExecutionConfiguration : IEntityTypeConfiguration<FlowExecution>
{
    public void Configure(EntityTypeBuilder<FlowExecution> entity)
    {
        entity.HasKey(e => e.Id).HasName("flow_execution_pkey");

        entity.ToTable("flow_execution");

        entity.HasIndex(e => new { e.Vault, e.StartedAt }, "flow_execution_vault_started_idx").IsDescending(false, true);

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.FlowId).HasColumnName("flow_id");
        entity.Property(e => e.FlowVersion).HasColumnName("flow_version");
        entity.Property(e => e.Definition)
            .HasColumnType("jsonb")
            .HasColumnName("definition");
        entity.Property(e => e.Vault).HasColumnName("vault");
        entity.Property(e => e.TargetKind).HasColumnName("target_kind");
        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.ItemId).HasColumnName("item_id");
        entity.Property(e => e.Status).HasColumnName("status");
        entity.Property(e => e.Error).HasColumnName("error");
        entity.Property(e => e.StartedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("started_at");
        entity.Property(e => e.FinishedAt).HasColumnName("finished_at");

        // A deleted flow takes its executions (the Flows feature refuses the delete while one is running).
        entity.HasOne(d => d.Flow).WithMany(p => p.Executions)
            .HasForeignKey(d => d.FlowId)
            .OnDelete(DeleteBehavior.Cascade)
            .HasConstraintName("flow_execution_flow_id_flow_id_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<FlowExecution> entity);
}
