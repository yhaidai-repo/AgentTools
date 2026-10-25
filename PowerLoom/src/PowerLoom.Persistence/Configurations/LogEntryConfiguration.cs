using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class LogEntryConfiguration : IEntityTypeConfiguration<LogEntry>
{
    public void Configure(EntityTypeBuilder<LogEntry> entity)
    {
        entity.HasKey(e => e.Id).HasName("log_entry_pkey");

        entity.ToTable("log_entry");

        entity.HasIndex(e => e.Fingerprint, "log_entry_fingerprint_uq").IsUnique();
        entity.HasIndex(e => e.LastAt, "log_entry_last_at_idx");
        entity.HasIndex(e => e.TaskId, "log_entry_task_idx");
        entity.HasIndex(e => e.RunId, "log_entry_run_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.Service).HasColumnName("service");
        entity.Property(e => e.Level).HasColumnName("level");
        entity.Property(e => e.Message).HasColumnName("message");
        entity.Property(e => e.Fingerprint).HasColumnName("fingerprint");
        entity.Property(e => e.Count)
            .HasDefaultValue(1)
            .HasColumnName("count");
        entity.Property(e => e.FirstAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("first_at");
        entity.Property(e => e.LastAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("last_at");
        entity.Property(e => e.RunId).HasColumnName("run_id");
        entity.Property(e => e.TaskId).HasColumnName("task_id");
        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.Vault).HasColumnName("vault");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<LogEntry> entity);
}
