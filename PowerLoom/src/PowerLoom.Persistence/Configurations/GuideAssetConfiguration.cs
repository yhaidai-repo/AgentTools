using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;
namespace PowerLoom.Persistence.Configurations;
public sealed class GuideAssetConfiguration : IEntityTypeConfiguration<GuideAsset>
{
    public void Configure(EntityTypeBuilder<GuideAsset> e)
    {
        e.ToTable("guide_asset"); e.HasKey(x => x.Id).HasName("guide_asset_pkey");
        e.Property(x => x.Id).HasColumnName("id");
        e.Property(x => x.TaskId).HasColumnName("task_id");
        e.Property(x => x.Vault).HasColumnName("vault");
        e.Property(x => x.Name).HasColumnName("name");
        e.Property(x => x.Sha256).HasColumnName("sha256");
        e.Property(x => x.MediaType).HasColumnName("media_type").HasDefaultValue("image/png");
        e.Property(x => x.Content).HasColumnName("content");
        e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
        e.HasIndex(x => x.TaskId).HasDatabaseName("guide_asset_task_idx");
        e.HasOne<LocalItem>().WithMany().HasForeignKey(x => x.TaskId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("guide_asset_task_id_fk");
        e.HasOne<Vault>().WithMany().HasForeignKey(x => x.Vault).OnDelete(DeleteBehavior.Restrict).HasConstraintName("guide_asset_vault_fk");
    }
}
