using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence.Configurations;

public partial class AgentRunConfiguration : IEntityTypeConfiguration<AgentRun>
{
    public void Configure(EntityTypeBuilder<AgentRun> entity)
    {
        entity.HasKey(e => e.Id).HasName("agent_run_pkey");

        entity.ToTable("agent_run");

        entity.HasIndex(e => new { e.Stage, e.StartedAt }, "agent_run_stage_started_idx");

        entity.HasIndex(e => e.PbiId, "agent_run_pbi_idx");

        entity.HasIndex(e => e.ItemId, "agent_run_item_idx");

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.ContinuesRunId).HasColumnName("continues_run_id");
        entity.Property(e => e.ConversationId).HasColumnName("conversation_id");
        entity.Property(e => e.EndedAt).HasColumnName("ended_at");
        entity.Property(e => e.Error).HasColumnName("error");
        entity.Property(e => e.Input).HasColumnName("input");
        entity.Property(e => e.ItemId).HasColumnName("item_id");
        entity.Property(e => e.Model).HasColumnName("model");
        entity.Property(e => e.Outputs)
            .HasColumnType("jsonb")
            .HasColumnName("outputs");
        entity.Property(e => e.PbiId).HasColumnName("pbi_id");
        entity.Property(e => e.PromptVersion).HasColumnName("prompt_version");
        entity.Property(e => e.StartedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("started_at");

        entity.HasOne(d => d.Item).WithMany(p => p.AgentRuns)
            .HasForeignKey(d => d.ItemId)
            .HasConstraintName("agent_run_item_id_local_item_id_fk");

        entity.HasOne(d => d.ContinuesRun).WithMany(p => p.ContinuedBy)
            .HasForeignKey(d => d.ContinuesRunId)
            .HasConstraintName("agent_run_continues_run_id_agent_run_id_fk");

        entity.HasOne(d => d.Pbi).WithMany(p => p.AgentRuns)
            .HasForeignKey(d => d.PbiId)
            .HasConstraintName("agent_run_pbi_id_work_item_ado_id_fk");

        entity.Property(e => e.Outcome)
            .HasDefaultValueSql("'running'::run_outcome")
            .HasColumnName("outcome");
        entity.Property(e => e.Stage).HasColumnName("stage");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<AgentRun> entity);
}
