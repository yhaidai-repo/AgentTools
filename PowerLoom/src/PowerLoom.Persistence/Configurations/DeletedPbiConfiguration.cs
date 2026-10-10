using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class DeletedPbiConfiguration : IEntityTypeConfiguration<DeletedPbi>
{
    public void Configure(EntityTypeBuilder<DeletedPbi> entity)
    {
        entity.HasKey(e => e.AdoId).HasName("deleted_pbi_pkey");

        entity.ToTable("deleted_pbi");

        entity.Property(e => e.AdoId)
            .ValueGeneratedNever()
            .HasColumnName("ado_id");
        entity.Property(e => e.DeletedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("deleted_at");
        entity.Property(e => e.Title).HasColumnName("title");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<DeletedPbi> entity);
}
