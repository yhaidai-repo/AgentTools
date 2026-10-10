using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using PowerLoom.Persistence.Enums;

#nullable disable

namespace PowerLoom.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class Baseline : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:Enum:attachment_origin", "upload,ado,confluence")
                .Annotation("Npgsql:Enum:bug_source", "ado,internal")
                .Annotation("Npgsql:Enum:entity_kind", "pbi,item")
                .Annotation("Npgsql:Enum:item_kind", "research,design,human,question,research-result,refinement,docs,finding,review,vault-review,goal")
                .Annotation("Npgsql:Enum:item_status", "open,in-progress,done,blocked,cancelled,answered,dismissed,draft,final,superseded,deleted")
                .Annotation("Npgsql:Enum:note_write_action", "created,updated")
                .Annotation("Npgsql:Enum:pipeline_status", "new,ready-for-refinement,refining,needs-research,researching,waiting-human,ready-for-design,designing,ready-for-dev,development,done,stale,closed")
                .Annotation("Npgsql:Enum:repo_kind", "ado,local")
                .Annotation("Npgsql:Enum:repo_source", "agent-assumed,user-confirmed,vault-documented")
                .Annotation("Npgsql:Enum:review_comment_status", "open,answered,withdrawn,outdated")
                .Annotation("Npgsql:Enum:review_severity", "blocker,major,minor,nit")
                .Annotation("Npgsql:Enum:review_status", "active,closed")
                .Annotation("Npgsql:Enum:run_outcome", "running,success,no-op,failed,budget-exceeded,gate-rejected,rate-limited,timeout,aborted,max-turns")
                .Annotation("Npgsql:Enum:stage", "sync,refinement,research,design,tech-writer,pull-requests,code-review,vault-review")
                .Annotation("Npgsql:Enum:vault_review_action", "keep,remove,actualize,close")
                .Annotation("Npgsql:Enum:work_item_source", "ado,local");

            migrationBuilder.CreateSequence(
                name: "local_pbi_id",
                startValue: 9000001L);

            migrationBuilder.CreateTable(
                name: "ado_state_change",
                columns: table => new
                {
                    ado_id = table.Column<int>(type: "integer", nullable: false),
                    rev = table.Column<int>(type: "integer", nullable: false),
                    from_state = table.Column<string>(type: "text", nullable: true),
                    to_state = table.Column<string>(type: "text", nullable: false),
                    changed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("ado_state_change_ado_id_rev_pk", x => new { x.ado_id, x.rev });
                });

            migrationBuilder.CreateTable(
                name: "config",
                columns: table => new
                {
                    key = table.Column<string>(type: "text", nullable: false),
                    value = table.Column<string>(type: "jsonb", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("config_pkey", x => x.key);
                });

            migrationBuilder.CreateTable(
                name: "deleted_pbi",
                columns: table => new
                {
                    ado_id = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("deleted_pbi_pkey", x => x.ado_id);
                });

            migrationBuilder.CreateTable(
                name: "deleted_pull_request",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("deleted_pull_request_pkey", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "skill_revision",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    name = table.Column<string>(type: "text", nullable: false),
                    folder = table.Column<string>(type: "text", nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("skill_revision_pkey", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sprint_snapshot",
                columns: table => new
                {
                    iteration_path = table.Column<string>(type: "text", nullable: false),
                    taken_on = table.Column<DateOnly>(type: "date", nullable: false),
                    ado_id = table.Column<int>(type: "integer", nullable: false),
                    ado_state = table.Column<string>(type: "text", nullable: false),
                    effort = table.Column<decimal>(type: "numeric", nullable: true),
                    remaining_work = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("sprint_snapshot_iteration_path_taken_on_ado_id_pk", x => new { x.iteration_path, x.taken_on, x.ado_id });
                });

            migrationBuilder.CreateTable(
                name: "vault",
                columns: table => new
                {
                    name = table.Column<string>(type: "text", nullable: false),
                    features = table.Column<string>(type: "jsonb", nullable: false),
                    import_folder = table.Column<string>(type: "text", nullable: true),
                    removed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("vault_pkey", x => x.name);
                });

            migrationBuilder.CreateTable(
                name: "vault_review_decision",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    vault = table.Column<string>(type: "text", nullable: false),
                    path = table.Column<string>(type: "text", nullable: false),
                    reasons = table.Column<string>(type: "text", nullable: false),
                    note_mtime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    task_id = table.Column<string>(type: "text", nullable: true),
                    run_id = table.Column<long>(type: "bigint", nullable: false),
                    decided_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    record_id = table.Column<string>(type: "text", nullable: true),
                    action = table.Column<VaultReviewAction>(type: "vault_review_action", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("vault_review_decision_pkey", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "www_record",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    vault = table.Column<string>(type: "text", nullable: false),
                    project = table.Column<string>(type: "text", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    planned = table.Column<string>(type: "text", nullable: false),
                    happened = table.Column<string>(type: "text", nullable: false),
                    fault = table.Column<string>(type: "text", nullable: false),
                    root_cause = table.Column<string>(type: "text", nullable: true),
                    resolution = table.Column<string>(type: "text", nullable: true),
                    preventive_action = table.Column<string>(type: "text", nullable: true),
                    assumptions = table.Column<string>(type: "text", nullable: true),
                    source = table.Column<string>(type: "text", nullable: false),
                    record_id = table.Column<string>(type: "text", nullable: true),
                    written_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    error = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("www_record_pkey", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "pbi_import",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    source = table.Column<string>(type: "text", nullable: false),
                    source_ref = table.Column<string>(type: "text", nullable: false),
                    title = table.Column<string>(type: "text", nullable: true),
                    sender = table.Column<string>(type: "text", nullable: true),
                    occurred_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    results = table.Column<string>(type: "jsonb", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    vault = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pbi_import_pkey", x => x.id);
                    table.ForeignKey(
                        name: "pbi_import_vault_vault_name_fk",
                        column: x => x.vault,
                        principalTable: "vault",
                        principalColumn: "name");
                });

            migrationBuilder.CreateTable(
                name: "pull_request",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false),
                    repo_id = table.Column<string>(type: "text", nullable: false),
                    repo_name = table.Column<string>(type: "text", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    description_md = table.Column<string>(type: "text", nullable: true),
                    author = table.Column<string>(type: "text", nullable: true),
                    source_ref = table.Column<string>(type: "text", nullable: false),
                    target_ref = table.Column<string>(type: "text", nullable: false),
                    source_commit = table.Column<string>(type: "text", nullable: false),
                    target_commit = table.Column<string>(type: "text", nullable: true),
                    iteration = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    is_draft = table.Column<bool>(type: "boolean", nullable: false, defaultValueSql: "false"),
                    work_item_ids = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    url = table.Column<string>(type: "text", nullable: false),
                    is_listed = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    ado_created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    synced_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    vault = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pull_request_pkey", x => x.id);
                    table.ForeignKey(
                        name: "pull_request_vault_vault_name_fk",
                        column: x => x.vault,
                        principalTable: "vault",
                        principalColumn: "name");
                });

            migrationBuilder.CreateTable(
                name: "repo",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    ado_project = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    remote_url = table.Column<string>(type: "text", nullable: false),
                    default_branch = table.Column<string>(type: "text", nullable: true),
                    summary = table.Column<string>(type: "text", nullable: true),
                    excluded = table.Column<bool>(type: "boolean", nullable: false, defaultValueSql: "false"),
                    synced_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    vault = table.Column<string>(type: "text", nullable: false),
                    kind = table.Column<RepoKind>(type: "repo_kind", nullable: false, defaultValueSql: "'ado'::repo_kind")
                },
                constraints: table =>
                {
                    table.PrimaryKey("repo_pkey", x => x.id);
                    table.ForeignKey(
                        name: "repo_vault_vault_name_fk",
                        column: x => x.vault,
                        principalTable: "vault",
                        principalColumn: "name");
                });

            migrationBuilder.CreateTable(
                name: "task_schedule",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    name = table.Column<string>(type: "text", nullable: false),
                    agent_id = table.Column<string>(type: "text", nullable: false),
                    cron = table.Column<string>(type: "text", nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    @params = table.Column<string>(name: "params", type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    last_run_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    last_result = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    vault = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("task_schedule_pkey", x => x.id);
                    table.ForeignKey(
                        name: "task_schedule_vault_vault_name_fk",
                        column: x => x.vault,
                        principalTable: "vault",
                        principalColumn: "name");
                });

            migrationBuilder.CreateTable(
                name: "vault_note_write",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    path = table.Column<string>(type: "text", nullable: false),
                    run_id = table.Column<long>(type: "bigint", nullable: false),
                    written_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    vault = table.Column<string>(type: "text", nullable: false),
                    action = table.Column<NoteWriteAction>(type: "note_write_action", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("vault_note_write_pkey", x => x.id);
                    table.ForeignKey(
                        name: "vault_note_write_vault_vault_name_fk",
                        column: x => x.vault,
                        principalTable: "vault",
                        principalColumn: "name");
                });

            migrationBuilder.CreateTable(
                name: "work_item",
                columns: table => new
                {
                    ado_id = table.Column<int>(type: "integer", nullable: false),
                    type = table.Column<string>(type: "text", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    ado_state = table.Column<string>(type: "text", nullable: false),
                    iteration_path = table.Column<string>(type: "text", nullable: true),
                    area_path = table.Column<string>(type: "text", nullable: true),
                    assigned_to = table.Column<string>(type: "text", nullable: true),
                    priority = table.Column<int>(type: "integer", nullable: true),
                    effort = table.Column<decimal>(type: "numeric", nullable: true),
                    remaining_work = table.Column<decimal>(type: "numeric", nullable: true),
                    rev = table.Column<int>(type: "integer", nullable: false),
                    content_hash = table.Column<string>(type: "text", nullable: false),
                    ado_changed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    vault_path = table.Column<string>(type: "text", nullable: true),
                    synced_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    backlog_priority = table.Column<double>(type: "double precision", nullable: true),
                    tags = table.Column<string>(type: "text", nullable: true),
                    description_md = table.Column<string>(type: "text", nullable: true),
                    acceptance_criteria_md = table.Column<string>(type: "text", nullable: true),
                    skills = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    skills_edited_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    confluence_pages = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    vault = table.Column<string>(type: "text", nullable: false),
                    parent_id = table.Column<int>(type: "integer", nullable: true),
                    pipeline_status = table.Column<PipelineStatus>(type: "pipeline_status", nullable: false, defaultValueSql: "'new'::pipeline_status"),
                    source = table.Column<WorkItemSource>(type: "work_item_source", nullable: false, defaultValueSql: "'ado'::work_item_source")
                },
                constraints: table =>
                {
                    table.PrimaryKey("work_item_pkey", x => x.ado_id);
                    table.ForeignKey(
                        name: "work_item_parent_id_work_item_ado_id_fk",
                        column: x => x.parent_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id");
                    table.ForeignKey(
                        name: "work_item_vault_vault_name_fk",
                        column: x => x.vault,
                        principalTable: "vault",
                        principalColumn: "name");
                });

            migrationBuilder.CreateTable(
                name: "code_review",
                columns: table => new
                {
                    pr_id = table.Column<int>(type: "integer", nullable: false),
                    closed_reason = table.Column<string>(type: "text", nullable: true),
                    reviewed_commit = table.Column<string>(type: "text", nullable: true),
                    reviewed_iteration = table.Column<int>(type: "integer", nullable: true),
                    summary_md = table.Column<string>(type: "text", nullable: true),
                    reviewed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    status = table.Column<ReviewStatus>(type: "review_status", nullable: false, defaultValueSql: "'active'::review_status")
                },
                constraints: table =>
                {
                    table.PrimaryKey("code_review_pkey", x => x.pr_id);
                    table.ForeignKey(
                        name: "code_review_pr_id_pull_request_id_fk",
                        column: x => x.pr_id,
                        principalTable: "pull_request",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "bug",
                columns: table => new
                {
                    work_item_id = table.Column<int>(type: "integer", nullable: false),
                    pbi_id = table.Column<int>(type: "integer", nullable: false),
                    reported_by = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    found_in = table.Column<PipelineStatus>(type: "pipeline_status", nullable: false),
                    source = table.Column<BugSource>(type: "bug_source", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("bug_pkey", x => x.work_item_id);
                    table.ForeignKey(
                        name: "bug_pbi_id_work_item_ado_id_fk",
                        column: x => x.pbi_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id");
                    table.ForeignKey(
                        name: "bug_work_item_id_work_item_ado_id_fk",
                        column: x => x.work_item_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id");
                });

            migrationBuilder.CreateTable(
                name: "pbi_feedback",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    pbi_id = table.Column<int>(type: "integer", nullable: false),
                    rating = table.Column<short>(type: "smallint", nullable: false),
                    effort_hours = table.Column<decimal>(type: "numeric", nullable: false),
                    www_record_id = table.Column<int>(type: "integer", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pbi_feedback_pkey", x => x.id);
                    table.ForeignKey(
                        name: "pbi_feedback_pbi_id_work_item_ado_id_fk",
                        column: x => x.pbi_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id");
                    table.ForeignKey(
                        name: "pbi_feedback_www_record_id_www_record_id_fk",
                        column: x => x.www_record_id,
                        principalTable: "www_record",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "agent_run",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    pbi_id = table.Column<int>(type: "integer", nullable: true),
                    item_id = table.Column<string>(type: "text", nullable: true),
                    prompt_version = table.Column<string>(type: "text", nullable: true),
                    model = table.Column<string>(type: "text", nullable: true),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    ended_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    error = table.Column<string>(type: "text", nullable: true),
                    input = table.Column<string>(type: "text", nullable: true),
                    outputs = table.Column<string>(type: "jsonb", nullable: true),
                    outcome = table.Column<RunOutcome>(type: "run_outcome", nullable: false, defaultValueSql: "'running'::run_outcome"),
                    stage = table.Column<Stage>(type: "stage", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("agent_run_pkey", x => x.id);
                    table.ForeignKey(
                        name: "agent_run_pbi_id_work_item_ado_id_fk",
                        column: x => x.pbi_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id");
                });

            migrationBuilder.CreateTable(
                name: "design",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    pbi_id = table.Column<int>(type: "integer", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    est_human_h = table.Column<decimal>(type: "numeric", nullable: true),
                    est_agent_h = table.Column<decimal>(type: "numeric", nullable: true),
                    complexity = table.Column<short>(type: "smallint", nullable: true),
                    confidence = table.Column<string>(type: "text", nullable: true),
                    risk_count = table.Column<int>(type: "integer", nullable: false, defaultValueSql: "0"),
                    test_count = table.Column<int>(type: "integer", nullable: false, defaultValueSql: "0"),
                    run_id = table.Column<long>(type: "bigint", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    approach = table.Column<string>(type: "text", nullable: false, defaultValueSql: "''::text"),
                    alternatives = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    plan = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    risks = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    tests = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    assumptions = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    estimate_basis = table.Column<string>(type: "text", nullable: false, defaultValueSql: "''::text")
                },
                constraints: table =>
                {
                    table.PrimaryKey("design_pkey", x => x.id);
                    table.CheckConstraint("design_complexity_ck", "complexity >= 1 AND complexity <= 5");
                    table.ForeignKey(
                        name: "design_pbi_id_work_item_ado_id_fk",
                        column: x => x.pbi_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id");
                    table.ForeignKey(
                        name: "design_run_id_agent_run_id_fk",
                        column: x => x.run_id,
                        principalTable: "agent_run",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "local_item",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    pbi_id = table.Column<int>(type: "integer", nullable: true),
                    parent_id = table.Column<string>(type: "text", nullable: true),
                    title = table.Column<string>(type: "text", nullable: false),
                    assignee = table.Column<string>(type: "text", nullable: false),
                    attempts = table.Column<int>(type: "integer", nullable: false, defaultValueSql: "0"),
                    created_by_run = table.Column<long>(type: "bigint", nullable: true),
                    vault_path = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    closed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    body = table.Column<string>(type: "text", nullable: true),
                    data = table.Column<string>(type: "jsonb", nullable: true),
                    resolution = table.Column<string>(type: "text", nullable: true),
                    held_by = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    handed_on_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    vault = table.Column<string>(type: "text", nullable: false),
                    kind = table.Column<ItemKind>(type: "item_kind", nullable: false),
                    status = table.Column<ItemStatus>(type: "item_status", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("local_item_pkey", x => x.id);
                    table.ForeignKey(
                        name: "local_item_created_by_run_agent_run_id_fk",
                        column: x => x.created_by_run,
                        principalTable: "agent_run",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "local_item_parent_id_local_item_id_fk",
                        column: x => x.parent_id,
                        principalTable: "local_item",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "local_item_pbi_id_work_item_ado_id_fk",
                        column: x => x.pbi_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id");
                    table.ForeignKey(
                        name: "local_item_vault_vault_name_fk",
                        column: x => x.vault,
                        principalTable: "vault",
                        principalColumn: "name");
                });

            migrationBuilder.CreateTable(
                name: "refinement",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    pbi_id = table.Column<int>(type: "integer", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    run_id = table.Column<long>(type: "bigint", nullable: true),
                    summary = table.Column<string>(type: "text", nullable: false),
                    scope_in = table.Column<string>(type: "jsonb", nullable: false),
                    scope_out = table.Column<string>(type: "jsonb", nullable: false),
                    ac_gaps = table.Column<string>(type: "jsonb", nullable: false),
                    dependencies = table.Column<string>(type: "jsonb", nullable: false),
                    repos = table.Column<string>(type: "jsonb", nullable: false),
                    assumptions = table.Column<string>(type: "jsonb", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    relevant_docs = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    docs_read = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    skills = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb")
                },
                constraints: table =>
                {
                    table.PrimaryKey("refinement_pkey", x => x.id);
                    table.ForeignKey(
                        name: "refinement_pbi_id_work_item_ado_id_fk",
                        column: x => x.pbi_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id");
                    table.ForeignKey(
                        name: "refinement_run_id_agent_run_id_fk",
                        column: x => x.run_id,
                        principalTable: "agent_run",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "review_comment",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    pr_id = table.Column<int>(type: "integer", nullable: false),
                    run_id = table.Column<long>(type: "bigint", nullable: true),
                    commit = table.Column<string>(type: "text", nullable: false),
                    file_path = table.Column<string>(type: "text", nullable: false),
                    start_line = table.Column<int>(type: "integer", nullable: false),
                    end_line = table.Column<int>(type: "integer", nullable: false),
                    body_md = table.Column<string>(type: "text", nullable: false),
                    code_snippet = table.Column<string>(type: "text", nullable: false),
                    snippet_start_line = table.Column<int>(type: "integer", nullable: false),
                    answer_md = table.Column<string>(type: "text", nullable: true),
                    answered_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    agent_reply_md = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    severity = table.Column<ReviewSeverity>(type: "review_severity", nullable: false),
                    status = table.Column<ReviewCommentStatus>(type: "review_comment_status", nullable: false, defaultValueSql: "'open'::review_comment_status")
                },
                constraints: table =>
                {
                    table.PrimaryKey("review_comment_pkey", x => x.id);
                    table.ForeignKey(
                        name: "review_comment_pr_id_pull_request_id_fk",
                        column: x => x.pr_id,
                        principalTable: "pull_request",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "review_comment_run_id_agent_run_id_fk",
                        column: x => x.run_id,
                        principalTable: "agent_run",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "status_history",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    entity_id = table.Column<string>(type: "text", nullable: false),
                    from_status = table.Column<string>(type: "text", nullable: true),
                    to_status = table.Column<string>(type: "text", nullable: false),
                    at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    actor = table.Column<string>(type: "text", nullable: false),
                    run_id = table.Column<long>(type: "bigint", nullable: true),
                    entity_kind = table.Column<EntityKind>(type: "entity_kind", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("status_history_pkey", x => x.id);
                    table.ForeignKey(
                        name: "status_history_run_id_agent_run_id_fk",
                        column: x => x.run_id,
                        principalTable: "agent_run",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "attachment",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    pbi_id = table.Column<int>(type: "integer", nullable: false),
                    item_id = table.Column<string>(type: "text", nullable: true),
                    source_url = table.Column<string>(type: "text", nullable: true),
                    file_name = table.Column<string>(type: "text", nullable: false),
                    content_type = table.Column<string>(type: "text", nullable: false),
                    size_bytes = table.Column<int>(type: "integer", nullable: false),
                    content = table.Column<byte[]>(type: "bytea", nullable: false),
                    text = table.Column<string>(type: "text", nullable: true),
                    vault_path = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    source_version = table.Column<int>(type: "integer", nullable: true),
                    origin = table.Column<AttachmentOrigin>(type: "attachment_origin", nullable: false, defaultValueSql: "'upload'::attachment_origin")
                },
                constraints: table =>
                {
                    table.PrimaryKey("attachment_pkey", x => x.id);
                    table.ForeignKey(
                        name: "attachment_item_id_local_item_id_fk",
                        column: x => x.item_id,
                        principalTable: "local_item",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "attachment_pbi_id_work_item_ado_id_fk",
                        column: x => x.pbi_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id");
                });

            migrationBuilder.CreateTable(
                name: "pbi_repo",
                columns: table => new
                {
                    pbi_id = table.Column<int>(type: "integer", nullable: false),
                    repo_id = table.Column<string>(type: "text", nullable: false),
                    question_id = table.Column<string>(type: "text", nullable: true),
                    source = table.Column<RepoSource>(type: "repo_source", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pbi_repo_pbi_id_repo_id_pk", x => new { x.pbi_id, x.repo_id });
                    table.ForeignKey(
                        name: "pbi_repo_pbi_id_work_item_ado_id_fk",
                        column: x => x.pbi_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id");
                    table.ForeignKey(
                        name: "pbi_repo_question_id_local_item_id_fk",
                        column: x => x.question_id,
                        principalTable: "local_item",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "pbi_repo_repo_id_repo_id_fk",
                        column: x => x.repo_id,
                        principalTable: "repo",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "vault_capture",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.SerialColumn),
                    run_id = table.Column<long>(type: "bigint", nullable: false),
                    pbi_id = table.Column<int>(type: "integer", nullable: false),
                    item_id = table.Column<string>(type: "text", nullable: true),
                    title = table.Column<string>(type: "text", nullable: false),
                    project = table.Column<string>(type: "text", nullable: false),
                    target = table.Column<string>(type: "text", nullable: false),
                    captured = table.Column<string>(type: "jsonb", nullable: false),
                    to_fill = table.Column<string>(type: "jsonb", nullable: false),
                    file_path = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    name = table.Column<string>(type: "text", nullable: false),
                    assumptions = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    status = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'pending'::text"),
                    errors = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb")
                },
                constraints: table =>
                {
                    table.PrimaryKey("vault_capture_pkey", x => x.id);
                    table.ForeignKey(
                        name: "vault_capture_item_id_local_item_id_fk",
                        column: x => x.item_id,
                        principalTable: "local_item",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "vault_capture_pbi_id_work_item_ado_id_fk",
                        column: x => x.pbi_id,
                        principalTable: "work_item",
                        principalColumn: "ado_id");
                    table.ForeignKey(
                        name: "vault_capture_run_id_agent_run_id_fk",
                        column: x => x.run_id,
                        principalTable: "agent_run",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "agent_run_pbi_idx",
                table: "agent_run",
                column: "pbi_id");

            migrationBuilder.CreateIndex(
                name: "agent_run_stage_started_idx",
                table: "agent_run",
                columns: new[] { "stage", "started_at" });

            migrationBuilder.CreateIndex(
                name: "attachment_pbi_idx",
                table: "attachment",
                column: "pbi_id");

            migrationBuilder.CreateIndex(
                name: "bug_pbi_idx",
                table: "bug",
                column: "pbi_id");

            migrationBuilder.CreateIndex(
                name: "design_pbi_version_uq",
                table: "design",
                columns: new[] { "pbi_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "local_item_kind_status_idx",
                table: "local_item",
                columns: new[] { "kind", "status" });

            migrationBuilder.CreateIndex(
                name: "local_item_pbi_status_idx",
                table: "local_item",
                columns: new[] { "pbi_id", "status" });

            migrationBuilder.CreateIndex(
                name: "pbi_feedback_pbi_idx",
                table: "pbi_feedback",
                column: "pbi_id");

            migrationBuilder.CreateIndex(
                name: "pbi_import_source_ref_uq",
                table: "pbi_import",
                columns: new[] { "source", "source_ref" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "pbi_import_updated_idx",
                table: "pbi_import",
                column: "updated_at");

            migrationBuilder.CreateIndex(
                name: "refinement_pbi_version_uq",
                table: "refinement",
                columns: new[] { "pbi_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "review_comment_pr_idx",
                table: "review_comment",
                columns: new[] { "pr_id", "status" });

            migrationBuilder.CreateIndex(
                name: "skill_revision_name_idx",
                table: "skill_revision",
                columns: new[] { "name", "created_at" });

            migrationBuilder.CreateIndex(
                name: "status_history_entity_idx",
                table: "status_history",
                columns: new[] { "entity_kind", "entity_id", "at" });

            migrationBuilder.CreateIndex(
                name: "vault_capture_pbi_idx",
                table: "vault_capture",
                column: "pbi_id");

            migrationBuilder.CreateIndex(
                name: "vault_note_write_path_idx",
                table: "vault_note_write",
                column: "path");

            migrationBuilder.CreateIndex(
                name: "vault_review_decision_note_idx",
                table: "vault_review_decision",
                columns: new[] { "vault", "path" });

            migrationBuilder.CreateIndex(
                name: "work_item_iteration_idx",
                table: "work_item",
                column: "iteration_path");

            migrationBuilder.CreateIndex(
                name: "work_item_parent_idx",
                table: "work_item",
                column: "parent_id");

            migrationBuilder.CreateIndex(
                name: "work_item_pipeline_status_idx",
                table: "work_item",
                column: "pipeline_status");

            migrationBuilder.AddForeignKey(
                name: "agent_run_item_id_local_item_id_fk",
                table: "agent_run",
                column: "item_id",
                principalTable: "local_item",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "agent_run_item_id_local_item_id_fk",
                table: "agent_run");

            migrationBuilder.DropTable(
                name: "ado_state_change");

            migrationBuilder.DropTable(
                name: "attachment");

            migrationBuilder.DropTable(
                name: "bug");

            migrationBuilder.DropTable(
                name: "code_review");

            migrationBuilder.DropTable(
                name: "config");

            migrationBuilder.DropTable(
                name: "deleted_pbi");

            migrationBuilder.DropTable(
                name: "deleted_pull_request");

            migrationBuilder.DropTable(
                name: "design");

            migrationBuilder.DropTable(
                name: "pbi_feedback");

            migrationBuilder.DropTable(
                name: "pbi_import");

            migrationBuilder.DropTable(
                name: "pbi_repo");

            migrationBuilder.DropTable(
                name: "refinement");

            migrationBuilder.DropTable(
                name: "review_comment");

            migrationBuilder.DropTable(
                name: "skill_revision");

            migrationBuilder.DropTable(
                name: "sprint_snapshot");

            migrationBuilder.DropTable(
                name: "status_history");

            migrationBuilder.DropTable(
                name: "task_schedule");

            migrationBuilder.DropTable(
                name: "vault_capture");

            migrationBuilder.DropTable(
                name: "vault_note_write");

            migrationBuilder.DropTable(
                name: "vault_review_decision");

            migrationBuilder.DropTable(
                name: "www_record");

            migrationBuilder.DropTable(
                name: "repo");

            migrationBuilder.DropTable(
                name: "pull_request");

            migrationBuilder.DropTable(
                name: "local_item");

            migrationBuilder.DropTable(
                name: "agent_run");

            migrationBuilder.DropTable(
                name: "work_item");

            migrationBuilder.DropTable(
                name: "vault");

            migrationBuilder.DropSequence(
                name: "local_pbi_id");
        }
    }
}
