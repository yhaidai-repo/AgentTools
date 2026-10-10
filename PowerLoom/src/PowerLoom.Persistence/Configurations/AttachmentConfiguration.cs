using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Configurations;

public partial class AttachmentConfiguration : IEntityTypeConfiguration<Attachment>
{
    public void Configure(EntityTypeBuilder<Attachment> entity)
    {
        entity.HasKey(e => e.Id).HasName("attachment_pkey");

        entity.ToTable("attachment");

        entity.HasIndex(e => e.PbiId, "attachment_pbi_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.Content).HasColumnName("content");
        entity.Property(e => e.ContentType).HasColumnName("content_type");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.FileName).HasColumnName("file_name");
        entity.Property(e => e.ItemId).HasColumnName("item_id");
        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.SizeBytes).HasColumnName("size_bytes");
        entity.Property(e => e.SourceUrl).HasColumnName("source_url");
        entity.Property(e => e.SourceVersion).HasColumnName("source_version");
        entity.Property(e => e.Text).HasColumnName("text");
        entity.Property(e => e.VaultPath).HasColumnName("vault_path");

        entity.HasOne(d => d.Item).WithMany(p => p.Attachments)
            .HasForeignKey(d => d.ItemId)
            .HasConstraintName("attachment_item_id_local_item_id_fk");

        entity.HasOne(d => d.Pbi).WithMany(p => p.Attachments)
            .HasForeignKey(d => d.PbiId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("attachment_pbi_id_work_item_ado_id_fk");

        entity.Property(e => e.Origin)
            .HasDefaultValueSql("'upload'::attachment_origin")
            .HasColumnName("origin");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<Attachment> entity);
}
