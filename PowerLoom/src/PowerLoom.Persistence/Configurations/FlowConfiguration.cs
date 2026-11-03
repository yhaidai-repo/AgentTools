using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class FlowConfiguration : IEntityTypeConfiguration<Flow>
{
    public void Configure(EntityTypeBuilder<Flow> entity)
    {
        entity.HasKey(e => e.Id).HasName("flow_pkey");

        entity.ToTable("flow");

        entity.HasIndex(e => new { e.Vault, e.Name }, "flow_vault_name_key").IsUnique();

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.Vault).HasColumnName("vault");
        entity.Property(e => e.Name).HasColumnName("name");
        entity.Property(e => e.Version)
            .HasDefaultValue(1)
            .HasColumnName("version");
        entity.Property(e => e.Definition)
            .HasColumnType("jsonb")
            .HasColumnName("definition");
        entity.Property(e => e.Trigger)
            .HasColumnType("jsonb")
            .HasColumnName("trigger");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.UpdatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("updated_at");

        entity.HasOne(d => d.VaultNavigation).WithMany()
            .HasForeignKey(d => d.Vault)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("flow_vault_vault_name_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<Flow> entity);
}
