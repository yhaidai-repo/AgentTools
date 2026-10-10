using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Configurations;

public partial class StatusHistoryConfiguration : IEntityTypeConfiguration<StatusHistory>
{
    public void Configure(EntityTypeBuilder<StatusHistory> entity)
    {
        entity.HasKey(e => e.Id).HasName("status_history_pkey");

        entity.ToTable("status_history");

        entity.HasIndex(e => new { e.EntityKind, e.EntityId, e.At }, "status_history_entity_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.Actor).HasColumnName("actor");
        entity.Property(e => e.At)
            .HasDefaultValueSql("now()")
            .HasColumnName("at");
        entity.Property(e => e.EntityId).HasColumnName("entity_id");
        entity.Property(e => e.FromStatus).HasColumnName("from_status");
        entity.Property(e => e.RunId).HasColumnName("run_id");
        entity.Property(e => e.ToStatus).HasColumnName("to_status");

        entity.HasOne(d => d.Run).WithMany(p => p.StatusHistories)
            .HasForeignKey(d => d.RunId)
            .HasConstraintName("status_history_run_id_agent_run_id_fk");

        entity.Property(e => e.EntityKind).HasColumnName("entity_kind");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<StatusHistory> entity);
}
