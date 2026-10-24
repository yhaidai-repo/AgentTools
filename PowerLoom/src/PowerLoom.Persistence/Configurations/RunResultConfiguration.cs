using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class RunResultConfiguration : IEntityTypeConfiguration<RunResult>
{
    public void Configure(EntityTypeBuilder<RunResult> entity)
    {
        entity.HasKey(e => e.Id).HasName("run_result_pkey");

        entity.ToTable("run_result");

        entity.HasIndex(e => e.RunId, "run_result_run_uq").IsUnique();
        entity.HasIndex(e => new { e.TaskId, e.CreatedAt }, "run_result_task_idx");
        entity.HasIndex(e => new { e.PbiId, e.CreatedAt }, "run_result_pbi_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.RunId).HasColumnName("run_id");
        entity.Property(e => e.TaskId).HasColumnName("task_id");
        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.Agent).HasColumnName("agent");
        entity.Property(e => e.Status).HasColumnName("status");
        entity.Property(e => e.Body).HasColumnName("body");
        entity.Property(e => e.Data)
            .HasColumnType("jsonb")
            .HasColumnName("data");
        entity.Property(e => e.Evidence)
            .HasColumnType("jsonb")
            .HasColumnName("evidence");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");

        entity.HasOne(d => d.Run).WithMany()
            .HasForeignKey(d => d.RunId)
            .OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("run_result_run_id_agent_run_id_fk");

        entity.HasOne(d => d.Task).WithMany()
            .HasForeignKey(d => d.TaskId)
            .OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("run_result_task_id_local_item_id_fk");

        entity.HasOne(d => d.Pbi).WithMany()
            .HasForeignKey(d => d.PbiId)
            .OnDelete(DeleteBehavior.SetNull)
            .HasConstraintName("run_result_pbi_id_work_item_ado_id_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<RunResult> entity);
}
