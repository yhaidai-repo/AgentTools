using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class AdoStateChangeConfiguration : IEntityTypeConfiguration<AdoStateChange>
{
    public void Configure(EntityTypeBuilder<AdoStateChange> entity)
    {
        entity.HasKey(e => new { e.AdoId, e.Rev }).HasName("ado_state_change_ado_id_rev_pk");

        entity.ToTable("ado_state_change");

        entity.Property(e => e.AdoId).HasColumnName("ado_id");
        entity.Property(e => e.Rev).HasColumnName("rev");
        entity.Property(e => e.ChangedAt).HasColumnName("changed_at");
        entity.Property(e => e.FromState).HasColumnName("from_state");
        entity.Property(e => e.ToState).HasColumnName("to_state");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<AdoStateChange> entity);
}
