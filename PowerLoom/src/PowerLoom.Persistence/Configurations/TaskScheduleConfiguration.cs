using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class TaskScheduleConfiguration : IEntityTypeConfiguration<TaskSchedule>
{
    public void Configure(EntityTypeBuilder<TaskSchedule> entity)
    {
        entity.HasKey(e => e.Id).HasName("task_schedule_pkey");

        entity.ToTable("task_schedule");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.AgentId).HasColumnName("agent_id");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.Cron).HasColumnName("cron");
        entity.Property(e => e.Enabled)
            .HasDefaultValue(true)
            .HasColumnName("enabled");
        entity.Property(e => e.LastResult).HasColumnName("last_result");
        entity.Property(e => e.LastRunAt).HasColumnName("last_run_at");
        entity.Property(e => e.Name).HasColumnName("name");
        entity.Property(e => e.Params)
            .HasDefaultValueSql("'{}'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("params");
        entity.Property(e => e.UpdatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("updated_at");
        entity.Property(e => e.Vault).HasColumnName("vault");

        entity.HasOne(d => d.VaultNavigation).WithMany(p => p.TaskSchedules)
            .HasForeignKey(d => d.Vault)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("task_schedule_vault_vault_name_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<TaskSchedule> entity);
}
