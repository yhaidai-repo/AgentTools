using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Conventions;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence;

// What keeps the model equal to the schema drizzle created (the baseline migration reproduces it exactly).
public partial class PowerLoomDbContext
{
    private static readonly KebabCaseNameTranslator Kebab = new();

    // EF adds an index for every foreign key; drizzle's schema has only the indexes the configurations name.
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Conventions.Remove(typeof(ForeignKeyIndexConvention));
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        // drizzle made the id columns `serial`, not identity columns.
        modelBuilder.UseSerialColumns();
        DeclareEnumsInOrder(modelBuilder);
    }

    // Npgsql's MapEnum lists the labels alphabetically; PostgreSQL orders enum values by label order, so the
    // declared order (drizzle's) is restated here.
    private static void DeclareEnumsInOrder(ModelBuilder modelBuilder)
    {
        modelBuilder
            .HasPostgresEnum("attachment_origin", LabelsOf<AttachmentOrigin>())
            .HasPostgresEnum("bug_source", LabelsOf<BugSource>())
            .HasPostgresEnum("entity_kind", LabelsOf<EntityKind>())
            .HasPostgresEnum("item_status", LabelsOf<ItemStatus>())
            .HasPostgresEnum("note_write_action", LabelsOf<NoteWriteAction>())
            .HasPostgresEnum("pipeline_status", LabelsOf<PipelineStatus>())
            .HasPostgresEnum("repo_kind", LabelsOf<RepoKind>())
            .HasPostgresEnum("repo_source", LabelsOf<RepoSource>())
            .HasPostgresEnum("review_comment_status", LabelsOf<ReviewCommentStatus>())
            .HasPostgresEnum("review_severity", LabelsOf<ReviewSeverity>())
            .HasPostgresEnum("review_status", LabelsOf<ReviewStatus>())
            .HasPostgresEnum("run_outcome", LabelsOf<RunOutcome>())
            .HasPostgresEnum("vault_review_action", LabelsOf<VaultReviewAction>())
            .HasPostgresEnum("work_item_source", LabelsOf<WorkItemSource>());
    }

    private static string[] LabelsOf<TEnum>()
        where TEnum : struct, Enum
    {
        return Enum.GetNames<TEnum>().Select(Kebab.TranslateMemberName).ToArray();
    }
}
