using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class WwwRecordConfiguration : IEntityTypeConfiguration<WwwRecord>
{
    public void Configure(EntityTypeBuilder<WwwRecord> entity)
    {
        entity.HasKey(e => e.Id).HasName("www_record_pkey");

        entity.ToTable("www_record");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.Assumptions).HasColumnName("assumptions");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.Error).HasColumnName("error");
        entity.Property(e => e.Fault).HasColumnName("fault");
        entity.Property(e => e.Happened).HasColumnName("happened");
        entity.Property(e => e.Kind).HasColumnName("kind");
        entity.Property(e => e.Planned).HasColumnName("planned");
        entity.Property(e => e.PreventiveAction).HasColumnName("preventive_action");
        entity.Property(e => e.Project).HasColumnName("project");
        entity.Property(e => e.RecordId).HasColumnName("record_id");
        entity.Property(e => e.Resolution).HasColumnName("resolution");
        entity.Property(e => e.RootCause).HasColumnName("root_cause");
        entity.Property(e => e.Source).HasColumnName("source");
        entity.Property(e => e.Title).HasColumnName("title");
        entity.Property(e => e.Vault).HasColumnName("vault");
        entity.Property(e => e.WrittenAt).HasColumnName("written_at");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<WwwRecord> entity);
}
