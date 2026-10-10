using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class SprintSnapshotConfiguration : IEntityTypeConfiguration<SprintSnapshot>
{
    public void Configure(EntityTypeBuilder<SprintSnapshot> entity)
    {
        entity.HasKey(e => new { e.IterationPath, e.TakenOn, e.AdoId }).HasName("sprint_snapshot_iteration_path_taken_on_ado_id_pk");

        entity.ToTable("sprint_snapshot");

        entity.Property(e => e.IterationPath).HasColumnName("iteration_path");
        entity.Property(e => e.TakenOn).HasColumnName("taken_on");
        entity.Property(e => e.AdoId).HasColumnName("ado_id");
        entity.Property(e => e.AdoState).HasColumnName("ado_state");
        entity.Property(e => e.Effort).HasColumnName("effort");
        entity.Property(e => e.RemainingWork).HasColumnName("remaining_work");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<SprintSnapshot> entity);
}
