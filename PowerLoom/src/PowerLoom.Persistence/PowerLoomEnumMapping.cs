using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Persistence;

// Every PostgreSQL enum of adoa's schema as a CLR enum; Npgsql adds them to the model and to the data source.
public static class PowerLoomEnumMapping
{
    public static NpgsqlDbContextOptionsBuilder MapPowerLoomEnums(this NpgsqlDbContextOptionsBuilder npgsql)
    {
        var kebab = new KebabCaseNameTranslator();

        npgsql.MapEnum<AttachmentOrigin>("attachment_origin", nameTranslator: kebab);
        npgsql.MapEnum<BugSource>("bug_source", nameTranslator: kebab);
        npgsql.MapEnum<EntityKind>("entity_kind", nameTranslator: kebab);
        npgsql.MapEnum<ItemKind>("item_kind", nameTranslator: kebab);
        npgsql.MapEnum<ItemStatus>("item_status", nameTranslator: kebab);
        npgsql.MapEnum<NoteWriteAction>("note_write_action", nameTranslator: kebab);
        npgsql.MapEnum<PipelineStatus>("pipeline_status", nameTranslator: kebab);
        npgsql.MapEnum<RepoKind>("repo_kind", nameTranslator: kebab);
        npgsql.MapEnum<RepoSource>("repo_source", nameTranslator: kebab);
        npgsql.MapEnum<ReviewCommentStatus>("review_comment_status", nameTranslator: kebab);
        npgsql.MapEnum<ReviewSeverity>("review_severity", nameTranslator: kebab);
        npgsql.MapEnum<ReviewStatus>("review_status", nameTranslator: kebab);
        npgsql.MapEnum<RunOutcome>("run_outcome", nameTranslator: kebab);
        npgsql.MapEnum<Stage>("stage", nameTranslator: kebab);
        npgsql.MapEnum<VaultReviewAction>("vault_review_action", nameTranslator: kebab);
        npgsql.MapEnum<WorkItemSource>("work_item_source", nameTranslator: kebab);

        return npgsql;
    }
}
