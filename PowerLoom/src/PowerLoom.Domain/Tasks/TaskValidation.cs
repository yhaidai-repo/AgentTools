using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Pbis;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using DocumentKinds = PowerLoom.Domain.Pbis.LinkedDocuments;

namespace PowerLoom.Domain.Tasks;

// Why an agent may not start a task yet (empty = it may): one check per AgentConfig `waitFor` key, reading the
// database only, so the dispatcher can check every task on every run (PowerLoom's validateTask).
public static class TaskValidation
{
    public const string HumanItems = "humanItems";
    public const string LinkedDocuments = "linkedDocuments";
    public const string Drafts = "drafts";
    public const string OtherAgentTasks = "otherAgentTasks";

    private static readonly string[] Known = [HumanItems, LinkedDocuments, Drafts, OtherAgentTasks];
    private static readonly string[] UnmergedDrafts = ["pending", "created", "appended"];
    private static readonly KebabCaseNameTranslator Labels = new();

    public static async Task<List<string>> ValidateAsync(PowerLoomDbContext db, LocalItem task, string agentId, IReadOnlyList<string> waitFor, bool webAccess, CancellationToken cancellation)
    {
        var reasons = WebAccessMissing(task, agentId, webAccess).Concat(waitFor.Where(key => !Known.Contains(key)).Select(key => $"Unknown blocker \"{key}\" in the agent's config")).ToList();

        reasons.AddRange(await AccessMissingAsync(db, task, cancellation));
        reasons.AddRange(await DependenciesOpenAsync(db, task, cancellation));

        // The waitFor checks are about the task's PBI; a task without one (e.g. a chat draft's tech-writer task) has
        // none to wait for.
        if (task.PbiId is null)
            return reasons;

        foreach (var key in waitFor.Where(Known.Contains))
            reasons.AddRange(await CheckAsync(db, key, agentId, task, webAccess, cancellation));

        return reasons;
    }

    private static Task<List<string>> CheckAsync(PowerLoomDbContext db, string key, string agentId, LocalItem task, bool webAccess, CancellationToken cancellation)
    {
        var pbiId = task.PbiId!.Value;

        return key switch
        {
            HumanItems => OpenHumanItemsAsync(db, pbiId, cancellation),
            LinkedDocuments => DocumentsWithoutContentAsync(db, pbiId, webAccess, cancellation),
            Drafts => UnmergedDraftsAsync(db, agentId, pbiId, cancellation),
            _ => OtherAgentsOpenTasksAsync(db, agentId, task, cancellation),
        };
    }

    // Always checked, not a waitFor box: a task that needs the web can't be done without web access (user decision
    // 2026-10-02).
    private static IEnumerable<string> WebAccessMissing(LocalItem task, string agentId, bool webAccess)
    {
        var needsWeb = task.Data is not null && JsonDocument.Parse(task.Data).RootElement.TryGetProperty("needsWeb", out var flag) && flag.ValueKind == JsonValueKind.True;

        return needsWeb && !webAccess ? [$"Needs web access: turn it on in {agentId}'s Config, or delete this task"] : [];
    }

    // Always checked, not a waitFor box: a task anchored to an open access request (a tool was refused for access, the
    // runner asked a person) waits for that fix (user decision 2026-10-13); the task runs again when it's closed.
    private static async Task<IEnumerable<string>> AccessMissingAsync(PowerLoomDbContext db, LocalItem task, CancellationToken cancellation)
    {
        var open = await AccessAnchors.OpenAnchorsAsync(db, task, cancellation);

        return open.Count > 0 ? [$"Waiting for access: {string.Join(", ", open)}"] : [];
    }

    // Always checked, not a waitFor box: the agent that created the task said what must close first.
    private static async Task<IEnumerable<string>> DependenciesOpenAsync(PowerLoomDbContext db, LocalItem task, CancellationToken cancellation)
    {
        var open = await TaskDependencies.OpenDependenciesAsync(db, task, cancellation);

        return open.Count > 0 ? [$"Waiting for {string.Join(", ", open)}"] : [];
    }

    // Findings are vault upkeep for the user, not PBI work, so they hold no agent (user decision 2026-10-02).
    private static async Task<List<string>> OpenHumanItemsAsync(PowerLoomDbContext db, int pbiId, CancellationToken cancellation)
    {
        var ids = await db.LocalItems.AsNoTracking()
            .Where(item => item.PbiId == pbiId && item.Assignee == HumanTasks.Assignee && item.Kind != ItemKind.Finding && (item.Status == ItemStatus.Open || item.Status == ItemStatus.InProgress))
            .OrderBy(item => item.Id).Select(item => item.Id).ToListAsync(cancellation);

        return ids.Count > 0 ? [$"Waiting for you: {string.Join(", ", ids)}"] : [];
    }

    // A linked document is settled when its content is attached or the user closed the task asking for it. An agent with
    // web access reads a web page itself (user decision 2026-10-14), so only the others wait for one.
    private static async Task<List<string>> DocumentsWithoutContentAsync(PowerLoomDbContext db, int pbiId, bool webAccess, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.AsNoTracking().Where(row => row.AdoId == pbiId).Select(row => new { row.DescriptionMd, row.AcceptanceCriteriaMd }).SingleOrDefaultAsync(cancellation);
        var attached = await db.Attachments.AsNoTracking().Where(row => row.PbiId == pbiId && row.SourceUrl != null).Select(row => row.SourceUrl!).ToListAsync(cancellation);
        var declined = await db.LocalItems.FromSql($"select * from local_item where pbi_id = {pbiId} and kind = 'human' and status in ('done', 'cancelled') and data->>'url' is not null").Select(item => item.Data!).ToListAsync(cancellation);
        var settled = attached.Concat(declined.Select(UrlOf).Where(url => url is not null).Select(url => url!)).Select(DocumentKinds.DocumentUrl).ToHashSet();
        var missing = pbi is null ? [] : UrlText.PbiLinkedUrls(pbi.DescriptionMd, pbi.AcceptanceCriteriaMd).Where(url => !settled.Contains(url) && !(webAccess && DocumentKinds.KindOf(url) == DocumentKinds.Web));

        return missing.Select(url => $"Linked document without content: {url}").ToList();
    }

    // Drafts the agent itself captured don't hold it back, nor do drafts whose merge task is blocked: nothing would merge
    // them, so they would hold every agent forever; the user gets a task for each instead (user decision 2026-10-13).
    private static async Task<List<string>> UnmergedDraftsAsync(PowerLoomDbContext db, string agentId, int pbiId, CancellationToken cancellation)
    {
        var drafts = await db.VaultCaptures.AsNoTracking()
            .Where(capture => capture.PbiId == pbiId && UnmergedDrafts.Contains(capture.Status))
            .Join(db.AgentRuns.AsNoTracking(), capture => capture.RunId, run => run.Id, (capture, run) => new { capture.Name, run.Stage })
            .ToListAsync(cancellation);
        var stuck = await StuckDraftsAsync(db, cancellation);
        var names = drafts.Where(draft => Labels.TranslateMemberName(draft.Stage.ToString()) != agentId && !stuck.Contains(draft.Name)).Select(draft => draft.Name).ToList();

        return names.Count > 0 ? [$"Vault drafts not merged: {string.Join(", ", names)}"] : [];
    }

    private static async Task<HashSet<string>> StuckDraftsAsync(PowerLoomDbContext db, CancellationToken cancellation)
    {
        var names = await db.Database
            .SqlQuery<string>($"select data->>'draft' as \"Value\" from local_item where kind = 'docs' and status = 'blocked' and data->>'draft' is not null")
            .ToListAsync(cancellation);

        return names.ToHashSet();
    }

    // Other agents' work is the PBI's open agent tasks of another kind (e.g. design waits for research), whoever takes them.
    private static async Task<List<string>> OtherAgentsOpenTasksAsync(PowerLoomDbContext db, string agentId, LocalItem task, CancellationToken cancellation)
    {
        var mine = AgentStages.AssigneeOf(agentId);
        var others = await db.LocalItems.AsNoTracking()
            .Where(item => item.PbiId == task.PbiId && item.Assignee.StartsWith("agent:") && item.Assignee != mine && item.Kind != task.Kind && (item.Status == ItemStatus.Open || item.Status == ItemStatus.InProgress))
            .OrderBy(item => item.Id).ToListAsync(cancellation);

        return others.Select(other => $"Waiting for {AgentStages.WorkerOf(other)}: {other.Id}").ToList();
    }

    private static string? UrlOf(string data)
    {
        using var document = JsonDocument.Parse(data);

        return document.RootElement.TryGetProperty("url", out var url) && url.ValueKind == JsonValueKind.String ? url.GetString() : null;
    }
}
