"""One-off after scaffolding (phase 1): the enum columns and enum indexes Npgsql's scaffold skips.

Run from src/PowerLoom.Persistence. Adds the CLR enums, the entity properties with their column defaults, and the
indexes on enum columns. The expression index local_item_pbi_key_uq goes into the baseline migration as raw SQL.
"""
import os
import re

ENUMS = {
    "attachment_origin": ("AttachmentOrigin", "upload, ado, confluence"),
    "bug_source": ("BugSource", "ado, internal"),
    "entity_kind": ("EntityKind", "pbi, item"),
    "item_kind": ("ItemKind", "research, design, human, question, research-result, refinement, docs, finding, review, vault-review, goal"),
    "item_status": ("ItemStatus", "open, in-progress, done, blocked, cancelled, answered, dismissed, draft, final, superseded, deleted"),
    "note_write_action": ("NoteWriteAction", "created, updated"),
    "pipeline_status": ("PipelineStatus", "new, ready-for-refinement, refining, needs-research, researching, waiting-human, ready-for-design, designing, ready-for-dev, development, done, stale, closed"),
    "repo_kind": ("RepoKind", "ado, local"),
    "repo_source": ("RepoSource", "agent-assumed, user-confirmed, vault-documented"),
    "review_comment_status": ("ReviewCommentStatus", "open, answered, withdrawn, outdated"),
    "review_severity": ("ReviewSeverity", "blocker, major, minor, nit"),
    "review_status": ("ReviewStatus", "active, closed"),
    "run_outcome": ("RunOutcome", "running, success, no-op, failed, budget-exceeded, gate-rejected, rate-limited, timeout, aborted, max-turns"),
    "stage": ("Stage", "sync, refinement, research, design, tech-writer, pull-requests, code-review, vault-review"),
    "vault_review_action": ("VaultReviewAction", "keep, remove, actualize, close"),
    "work_item_source": ("WorkItemSource", "ado, local"),
}

# entity, property, enum, column, default SQL
COLUMNS = [
    ("AgentRun", "Outcome", "RunOutcome", "outcome", "'running'::run_outcome"),
    ("AgentRun", "Stage", "Stage", "stage", None),
    ("Attachment", "Origin", "AttachmentOrigin", "origin", "'upload'::attachment_origin"),
    ("Bug", "FoundIn", "PipelineStatus", "found_in", None),
    ("Bug", "Source", "BugSource", "source", None),
    ("CodeReview", "Status", "ReviewStatus", "status", "'active'::review_status"),
    ("LocalItem", "Kind", "ItemKind", "kind", None),
    ("LocalItem", "Status", "ItemStatus", "status", None),
    ("PbiRepo", "Source", "RepoSource", "source", None),
    ("Repo", "Kind", "RepoKind", "kind", "'ado'::repo_kind"),
    ("ReviewComment", "Severity", "ReviewSeverity", "severity", None),
    ("ReviewComment", "Status", "ReviewCommentStatus", "status", "'open'::review_comment_status"),
    ("StatusHistory", "EntityKind", "EntityKind", "entity_kind", None),
    ("VaultNoteWrite", "Action", "NoteWriteAction", "action", None),
    ("VaultReviewDecision", "Action", "VaultReviewAction", "action", None),
    ("WorkItem", "PipelineStatus", "PipelineStatus", "pipeline_status", "'new'::pipeline_status"),
    ("WorkItem", "Source", "WorkItemSource", "source", "'ado'::work_item_source"),
]

INDEXES = {
    "WorkItem": ['entity.HasIndex(e => e.PipelineStatus, "work_item_pipeline_status_idx");'],
    "StatusHistory": ['entity.HasIndex(e => new { e.EntityKind, e.EntityId, e.At }, "status_history_entity_idx");'],
    "LocalItem": [
        'entity.HasIndex(e => new { e.PbiId, e.Status }, "local_item_pbi_status_idx");',
        'entity.HasIndex(e => new { e.Kind, e.Status }, "local_item_kind_status_idx");',
    ],
    "AgentRun": ['entity.HasIndex(e => new { e.Stage, e.StartedAt }, "agent_run_stage_started_idx");'],
    "ReviewComment": ['entity.HasIndex(e => new { e.PrId, e.Status }, "review_comment_pr_idx");'],
}


def pascal(label):
    return "".join(part.capitalize() for part in label.split("-"))


def read(path):
    with open(path, encoding="utf-8-sig") as file:
        return file.read()


def write(path, text):
    with open(path, "w", encoding="utf-8") as file:
        file.write(text)


def write_enums():
    os.makedirs("Enums", exist_ok=True)

    for pg_name, (cs_name, labels) in ENUMS.items():
        members = ",\n".join(f"    {pascal(label.strip())}" for label in labels.split(","))
        header = f"// PostgreSQL enum `{pg_name}`; the labels are the kebab-case of the member names (KebabCaseNameTranslator)."
        write(f"Enums/{cs_name}.cs", f"namespace PowerLoom.Persistence.Enums;\n\n{header}\npublic enum {cs_name}\n{{\n{members},\n}}\n")


def property_lines(entity):
    return "".join(f"    public {enum} {prop} {{ get; set; }}\n\n" for e, prop, enum, _, _ in COLUMNS if e == entity)


def configuration_lines(entity):
    lines = ""

    for e, prop, enum, column, default in COLUMNS:
        if e != entity:
            continue

        if default:
            lines += f'        entity.Property(e => e.{prop})\n            .HasDefaultValueSql("{default}")\n            .HasColumnName("{column}");\n'
        else:
            lines += f'        entity.Property(e => e.{prop}).HasColumnName("{column}");\n'

    return lines


def add_properties(entity):
    path = f"Entities/{entity}.cs"
    text = read(path)
    navigation = re.search(r"    public virtual ", text)
    at = navigation.start() if navigation else text.rindex("}")
    text = text[:at] + property_lines(entity) + text[at:]
    text = text.replace("namespace PowerLoom.Persistence.Entities;", "using PowerLoom.Persistence.Enums;\n\nnamespace PowerLoom.Persistence.Entities;", 1)
    write(path, text)


def add_configuration(entity):
    path = f"Configurations/{entity}Configuration.cs"
    text = read(path)
    anchor = "        OnConfigurePartial(entity);"
    assert anchor in text, path
    text = text.replace(anchor, configuration_lines(entity) + "\n" + anchor, 1)

    for index in INDEXES.get(entity, []):
        table = re.search(r"        entity\.ToTable\([^\n]*\);\n", text)
        assert table, path
        text = text[:table.end()] + "\n        " + index + "\n" + text[table.end():]

    text = text.replace("using PowerLoom.Persistence.Entities;", "using PowerLoom.Persistence.Entities;\nusing PowerLoom.Persistence.Enums;", 1)
    write(path, text)


write_enums()

for entity_name in sorted({column[0] for column in COLUMNS}):
    add_properties(entity_name)
    add_configuration(entity_name)

print(f"{len(ENUMS)} enums, {len(COLUMNS)} columns, {sum(len(v) for v in INDEXES.values())} indexes")
