using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class RefinementConfiguration : IEntityTypeConfiguration<Refinement>
{
    public void Configure(EntityTypeBuilder<Refinement> entity)
    {
        entity.HasKey(e => e.Id).HasName("refinement_pkey");

        entity.ToTable("refinement");

        entity.HasIndex(e => new { e.PbiId, e.Version }, "refinement_pbi_version_uq").IsUnique();

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.AcGaps)
            .HasColumnType("jsonb")
            .HasColumnName("ac_gaps");
        entity.Property(e => e.Assumptions)
            .HasColumnType("jsonb")
            .HasColumnName("assumptions");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");
        entity.Property(e => e.Dependencies)
            .HasColumnType("jsonb")
            .HasColumnName("dependencies");
        entity.Property(e => e.DocsRead)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("docs_read");
        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.RelevantDocs)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("relevant_docs");
        entity.Property(e => e.Repos)
            .HasColumnType("jsonb")
            .HasColumnName("repos");
        entity.Property(e => e.Details)
            .HasColumnType("jsonb")
            .HasColumnName("details");
        entity.Property(e => e.EstHours).HasColumnName("est_hours");
        entity.Property(e => e.EstimateBasis).HasColumnName("estimate_basis");
        entity.Property(e => e.RunId).HasColumnName("run_id");
        entity.Property(e => e.ScopeIn)
            .HasColumnType("jsonb")
            .HasColumnName("scope_in");
        entity.Property(e => e.ScopeOut)
            .HasColumnType("jsonb")
            .HasColumnName("scope_out");
        entity.Property(e => e.Skills)
            .HasDefaultValueSql("'[]'::jsonb")
            .HasColumnType("jsonb")
            .HasColumnName("skills");
        entity.Property(e => e.Summary).HasColumnName("summary");
        entity.Property(e => e.Version).HasColumnName("version");

        entity.HasOne(d => d.Pbi).WithMany(p => p.Refinements)
            .HasForeignKey(d => d.PbiId)
            .OnDelete(DeleteBehavior.ClientSetNull)
            .HasConstraintName("refinement_pbi_id_work_item_ado_id_fk");

        entity.HasOne(d => d.Run).WithMany(p => p.Refinements)
            .HasForeignKey(d => d.RunId)
            .HasConstraintName("refinement_run_id_agent_run_id_fk");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<Refinement> entity);
}
