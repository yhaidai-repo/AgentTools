using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PowerLoom.Persistence.Entities;

namespace PowerLoom.Persistence.Configurations;

public partial class AgentPromptVersionConfiguration : IEntityTypeConfiguration<AgentPromptVersion>
{
    public void Configure(EntityTypeBuilder<AgentPromptVersion> entity)
    {
        entity.HasKey(e => e.Id).HasName("agent_prompt_version_pkey");

        entity.ToTable("agent_prompt_version");

        entity.HasIndex(e => new { e.AgentId, e.Version }, "agent_prompt_version_agent_version_uq").IsUnique();

        entity.Property(e => e.Id).HasColumnName("id");
        entity.Property(e => e.AgentId).HasColumnName("agent_id");
        entity.Property(e => e.Version).HasColumnName("version");
        entity.Property(e => e.Text).HasColumnName("text");
        entity.Property(e => e.CreatedAt)
            .HasDefaultValueSql("now()")
            .HasColumnName("created_at");

        OnConfigurePartial(entity);
    }

    partial void OnConfigurePartial(EntityTypeBuilder<AgentPromptVersion> entity);
}
