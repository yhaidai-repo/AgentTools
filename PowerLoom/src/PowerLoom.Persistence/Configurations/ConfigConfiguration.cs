using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class ConfigConfiguration : IEntityTypeConfiguration<Config>
{
    public void Configure(EntityTypeBuilder<Config> entity)
    {
        entity.HasKey(e => e.Key).HasName("config_pkey");

        entity.ToTable("config");

        entity.Property(e => e.Key).HasColumnName("key");
        entity.Property(e => e.UpdatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("updated_at");
        entity.Property(e => e.Value)
            .HasColumnType("jsonb")
            .HasColumnName("value");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<Config> entity);
}
