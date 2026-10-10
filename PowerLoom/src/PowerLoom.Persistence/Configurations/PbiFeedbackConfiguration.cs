using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class PbiFeedbackConfiguration : IEntityTypeConfiguration<PbiFeedback>
{
    public void Configure(EntityTypeBuilder<PbiFeedback> entity)
    {
        entity.HasKey(e => e.Id).HasName("pbi_feedback_pkey");

        entity.ToTable("pbi_feedback");

        entity.HasIndex(e => e.PbiId, "pbi_feedback_pbi_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.EffortHours).HasColumnName("effort_hours");
        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.Rating).HasColumnName("rating");
        entity.Property(e => e.WwwRecordId).HasColumnName("www_record_id");

        entity.HasOne(d => d.Pbi).WithMany(p => p.PbiFeedbacks)
            .HasForeignKey(d => d.PbiId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("pbi_feedback_pbi_id_work_item_ado_id_fk");

        entity.HasOne(d => d.WwwRecord).WithMany(p => p.PbiFeedbacks)
            .HasForeignKey(d => d.WwwRecordId)
            .HasConstraintName("pbi_feedback_www_record_id_www_record_id_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<PbiFeedback> entity);
}
