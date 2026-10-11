using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Contracts;
using PowerLoom.Domain.Pbis.Models;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.Backlog;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PbiSkill = PowerLoom.Features.Continue.Models.PbiSkill;

namespace PowerLoom.Features.Continue.Targets;

// The chat that implements a PBI: with a design, its plan and tests as checklists; without one, the PBI note and the
// refinement are the spec (user decision 2026-10-10: no readiness checks, no status change).
public sealed class PbiChatTarget(PowerLoomDbContext db, HostPaths hostPaths, PbiRepos pbiRepos) : IChatTarget
{
    // adoa's commands on the command line (user decision 2026-10-09); the input is JSON on stdin.
    private const string AdoaCli = "docker exec -i adoa-web-1 npm run -s cli -w @adoa/web --";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // What the chat reads besides the PBI, refinement and design: final research results, the user's answers, and the
    // findings still waiting for review (the briefing's risks).
    private static readonly Dictionary<ItemKind, (ItemStatus Status, string About)> ReadFirstItems = new()
    {
        [ItemKind.ResearchResult] = (ItemStatus.Final, "research result"),
        [ItemKind.Question] = (ItemStatus.Answered, "answered question"),
        [ItemKind.Human] = (ItemStatus.Done, "done human task"),
        [ItemKind.Finding] = (ItemStatus.Open, "open finding"),
    };

    public ChatKind Kind => ChatKind.Pbi;

    public async Task<Outcome<ChatBrief>> BriefAsync(string id, IChatLauncher launcher, CancellationToken cancellation)
    {
        var pbi = int.TryParse(id, out var adoId) ? await db.WorkItems.AsNoTracking().SingleOrDefaultAsync(row => row.AdoId == adoId, cancellation) : null;

        if (pbi is null)
            return Outcome<ChatBrief>.Failure(Problem.NotFound($"PBI-{id} isn't in adoa."));

        var design = await db.Designs.AsNoTracking().Where(row => row.PbiId == adoId).OrderByDescending(row => row.Version).FirstOrDefaultAsync(cancellation);
        var plan = design is null ? [] : JsonSerializer.Deserialize<List<DesignPlanStep>>(design.Plan, Json) ?? [];
        var tests = design is null ? [] : JsonSerializer.Deserialize<List<DesignTest>>(design.Tests, Json) ?? [];
        var repos = plan.Count > 0 ? plan.Select(step => step.Repo.Trim()).Where(repo => repo.Length > 0).Distinct().ToList() : await pbiRepos.NamesAsync(adoId, cancellation);
        var brief = ChatBrief.For(pbi.Vault, $"Implement PBI-{adoId}: {pbi.Title}") with
        {
            ReadFirst = await ReadFirstAsync(pbi, design is not null, cancellation),
            Briefing =
            [
                "**Bug or feature?** First say which: a bug fixes wrong behaviour, a feature is new or changed behaviour.",
                "Then the matching outline under Briefing outlines below, in its order.",
            ],
            Ending = "End the briefing by asking: \"Implement this plan?\" Change no file before the user says yes.",
            AfterYes = [AfterYes(adoId, pbi.Title, design is not null)],
            Repos = repos,
            Skills = Skills(pbi),
            Sections = Sections(pbi, plan, tests, design is not null),
            Rules =
            [
                $"Done when the acceptance criteria in [[{BacklogPaths.PbiNoteName(adoId)}]] and the tests pass.",
                $"An issue found in this PBI's implementation that the plan doesn't cover is a bug: after the user's yes, report it with `{AdoaCli} bug.report` and `{{\"parent\": \"{adoId}\", \"title\": \"…\", \"descriptionMd\": \"steps, expected, actual\"}}` on stdin. adoa's agents refine and design the fix as a child item.",
            ],
        };

        return Outcome<ChatBrief>.Success(brief);
    }

    private async Task<IReadOnlyList<ReadFirstLink>> ReadFirstAsync(WorkItem pbi, bool hasDesign, CancellationToken cancellation)
    {
        if (pbi.VaultPath is null)
            return [];

        var links = new List<ReadFirstLink> { new(BacklogPaths.PbiNoteName(pbi.AdoId), hostPaths.BacklogPath(pbi.Vault, pbi.VaultPath), "the PBI: description, acceptance criteria") };

        if (await db.Refinements.AnyAsync(row => row.PbiId == pbi.AdoId, cancellation))
            links.Add(new ReadFirstLink(BacklogPaths.RefinementNoteName(pbi.AdoId), hostPaths.BacklogPath(pbi.Vault, BacklogPaths.RefinementNotePath(pbi.VaultPath, pbi.AdoId)), "refinement: scope, gaps, relevant docs"));

        if (hasDesign)
            links.Add(new ReadFirstLink(BacklogPaths.DesignNoteName(pbi.AdoId), hostPaths.BacklogPath(pbi.Vault, BacklogPaths.DesignNotePath(pbi.VaultPath, pbi.AdoId)), "design: approach, risks, assumptions"));

        var items = await db.LocalItems.AsNoTracking().Where(item => item.PbiId == pbi.AdoId && item.VaultPath != null).ToListAsync(cancellation);

        links.AddRange(items.Where(IsReadFirst).Select(item => new ReadFirstLink(item.Id, hostPaths.BacklogPath(pbi.Vault, item.VaultPath!), $"{ReadFirstItems[item.Kind].About}: {item.Title}")));

        return links;
    }

    private static bool IsReadFirst(LocalItem item) => ReadFirstItems.TryGetValue(item.Kind, out var wanted) && wanted.Status == item.Status;

    private static IReadOnlyList<ChatSkill> Skills(WorkItem pbi)
    {
        return (JsonSerializer.Deserialize<List<PbiSkill>>(pbi.Skills, Json) ?? []).Select(skill => new ChatSkill(skill.Name, skill.Reason)).ToList();
    }

    private static string AfterYes(int adoId, string title, bool hasDesign)
    {
        var branch = $"in each repo create the branch with the `create-branch` skill for \"#{adoId} {title}\"";

        return hasDesign
            ? $"After a yes: {branch}, work through the Plan checklist, then run the Tests."
            : $"After a yes: agree the plan with the user from the PBI note and the refinement, then {branch} and implement it.";
    }

    private static IReadOnlyList<ChatSection> Sections(WorkItem pbi, IReadOnlyList<DesignPlanStep> plan, IReadOnlyList<DesignTest> tests, bool hasDesign)
    {
        var sections = new List<ChatSection>();

        if (pbi.VaultPath is null)
            sections.Add(new ChatSection("PBI", $"{pbi.DescriptionMd ?? "(no description)"}\n\nAcceptance criteria:\n\n{pbi.AcceptanceCriteriaMd ?? "(none)"}"));

        sections.Add(new ChatSection("Briefing outlines", ImplementBriefing.OutlinesMarkdown()));

        if (!hasDesign)
        {
            sections.Add(new ChatSection("Plan", "No design yet: the PBI note and the refinement are the spec; agree the plan in the chat before changing anything."));

            return sections;
        }

        sections.Add(new ChatSection("Plan", Checklist(plan.Select((step, index) => $"{index + 1}. {step.Step} ({step.Repo}; {string.Join(", ", step.Locations ?? [])}{(step.Locations is { Length: > 0 } ? "" : "–")}): {step.Change}{(step.AgentDoable ? "" : " **User step: not for the chat.**")}"))));
        sections.Add(new ChatSection("Tests", Checklist(tests.Select(test => $"{test.Kind}: {test.Case}"))));

        return sections;
    }

    private static string Checklist(IEnumerable<string> items)
    {
        var list = items.ToList();

        return list.Count > 0 ? string.Join("\n", list.Select(item => $"- [ ] {item}")) : "None.";
    }
}
