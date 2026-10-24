using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class DataAccessConfiguration : IEntityTypeConfiguration<DataAccess>
{
    public void Configure(EntityTypeBuilder<DataAccess> entity)
    {
        entity.HasKey(e => e.Id).HasName("data_access_pkey");

        entity.ToTable("data_access");

        entity.HasIndex(e => new { e.Vault, e.StartedAt }, "data_access_vault_started_idx");
        entity.HasIndex(e => new { e.Resource, e.StartedAt }, "data_access_resource_started_idx");
        entity.HasIndex(e => e.RunId, "data_access_run_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.Vault).HasColumnName("vault");
        entity.Property(e => e.AgentId).HasColumnName("agent_id");
        entity.Property(e => e.RunId).HasColumnName("run_id");
        entity.Property(e => e.TaskId).HasColumnName("task_id");
        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.Tool).HasColumnName("tool");
        entity.Property(e => e.Kind).HasColumnName("kind");
        entity.Property(e => e.Resource).HasColumnName("resource");
        entity.Property(e => e.Target).HasColumnName("target");
        entity.Property(e => e.Request).HasColumnName("request");
        entity.Property(e => e.Outcome).HasColumnName("outcome");
        entity.Property(e => e.Reason).HasColumnName("reason");
        entity.Property(e => e.Rows).HasColumnName("rows");
        entity.Property(e => e.Bytes).HasColumnName("bytes");
        entity.Property(e => e.Truncated).HasColumnName("truncated");
        entity.Property(e => e.StartedAt).HasColumnName("started_at");
        entity.Property(e => e.DurationMs).HasColumnName("duration_ms");

        entity.HasOne(d => d.VaultNavigation).WithMany()
            .HasForeignKey(d => d.Vault)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("data_access_vault_vault_name_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<DataAccess> entity);
}
