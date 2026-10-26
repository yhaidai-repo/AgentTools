// The GitHub tools' answers as text: one line per pull request or issue, a detail with its comments, and checks.

type Json = Record<string, any>;

const MAX_BODY = 4000;
const MAX_COMMENT = 1500;

export function pullListText(pulls: Json[]): string {
  return pulls.map((pull) => `- #${pull.number} ${pull.title} · ${pull.state}${pull.draft ? " (draft)" : ""} · ${pull.user?.login ?? "–"} · ${pull.head?.ref} → ${pull.base?.ref} · updated ${day(pull.updated_at)}`).join("\n") || "No pull requests.";
}

export function pullText(detail: { pull: Json; files: Json[]; reviews: Json[]; reviewComments: Json[]; comments: Json[] }): string {
  const { pull } = detail;
  const head = `#${pull.number} ${pull.title} · ${pull.state}${pull.merged_at ? " (merged)" : ""}${pull.draft ? " (draft)" : ""} · by ${pull.user?.login} · ${pull.head?.ref} (${short(pull.head?.sha)}) → ${pull.base?.ref} · ${pull.html_url}`;
  const files = detail.files.map((file) => `- ${file.filename} (${file.status}, +${file.additions} -${file.deletions})`);
  const reviews = detail.reviews.map((review) => `- ${review.user?.login}: ${review.state}${review.body ? `: ${cut(review.body, MAX_COMMENT)}` : ""}`);
  const lineComments = detail.reviewComments.map((comment) => `- ${comment.user?.login} on ${comment.path}:${comment.line ?? comment.original_line ?? "?"}: ${cut(comment.body, MAX_COMMENT)}`);
  const comments = detail.comments.map((comment) => `- ${comment.user?.login}: ${cut(comment.body, MAX_COMMENT)}`);

  return [head, "", cut(pull.body ?? "(no description)", MAX_BODY), section("Files", files), section("Reviews", reviews), section("Line comments", lineComments), section("Comments", comments)].join("\n");
}

export function issueListText(issues: Json[]): string {
  return issues.map((issue) => `- #${issue.number} ${issue.title} · ${issue.state} · ${issue.user?.login ?? "–"}${labels(issue)} · updated ${day(issue.updated_at)}`).join("\n") || "No issues.";
}

export function issueText(detail: { issue: Json; comments: Json[] }): string {
  const { issue } = detail;
  const head = `#${issue.number} ${issue.title} · ${issue.state} · by ${issue.user?.login}${labels(issue)} · ${issue.html_url}`;
  const comments = detail.comments.map((comment) => `- ${comment.user?.login}: ${cut(comment.body, MAX_COMMENT)}`);

  return [head, "", cut(issue.body ?? "(no description)", MAX_BODY), section("Comments", comments)].join("\n");
}

export function checksText(ref: string, checks: { runs: Json[]; status: Json }): string {
  const runs = checks.runs.map((run) => `- ${run.name}: ${run.status}${run.conclusion ? ` (${run.conclusion})` : ""}${run.html_url ? ` ${run.html_url}` : ""}`);
  const statuses = (checks.status.statuses ?? []).map((status: Json) => `- ${status.context}: ${status.state}${status.description ? ` (${status.description})` : ""}`);

  return [`Checks of ${ref}: combined status ${checks.status.state ?? "none"}`, section("Check runs", runs), section("Statuses", statuses)].join("\n");
}

function section(title: string, lines: string[]): string {
  return lines.length > 0 ? `\n## ${title}\n${lines.join("\n")}` : "";
}

function labels(item: Json): string {
  const names = (item.labels ?? []).map((label: Json) => label.name).filter(Boolean);

  return names.length > 0 ? ` · [${names.join(", ")}]` : "";
}

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function day(iso: string | undefined): string {
  return iso?.slice(0, 10) ?? "–";
}

function short(sha: string | undefined): string {
  return sha?.slice(0, 8) ?? "–";
}
