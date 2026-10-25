using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Repos;
using PowerLoom.Domain.Tasks.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Domain.Tasks;

// The answer to refinement's repo question (user decision 2026-10-02): "Confirm" keeps the asked repos, a list names
// the repos to use instead, and Dismiss drops the guesses. Checked before anything is stored.
public static partial class RepoConfirmation
{
    private const string KeyPrefix = "repos:";

    public static async Task<string?> ProblemAsync(PowerLoomDbContext db, LocalItem item, CloseItemRequest request, CancellationToken cancellation)
    {
        if (!IsRepoQuestion(item) || request.Decision != CloseDecision.Answer || IsConfirmation(request.Resolution))
            return null;

        var names = ListedRepos(request.Resolution);

        if (names.Count == 0)
            return "Answer \"Confirm\", or the repos to use, comma-separated.";

        var known = await RepoCatalog.FindAsync(db, item.Vault, names, cancellation);
        var unknown = names.Where(name => !known.Any(repo => repo.Name.Equals(name, StringComparison.OrdinalIgnoreCase))).ToList();

        return unknown.Count > 0 ? $"Not in the repo catalog: {string.Join(", ", unknown)}." : null;
    }

    public static async Task ApplyAsync(PowerLoomDbContext db, LocalItem item, CloseItemRequest request, CancellationToken cancellation)
    {
        if (!IsRepoQuestion(item) || item.PbiId is null)
            return;

        var asked = await RepoCatalog.FindAsync(db, item.Vault, AskedRepos(item), cancellation);

        if (request.Decision == CloseDecision.Dismiss)
        {
            await DropAsync(db, item.PbiId.Value, asked, cancellation);

            return;
        }

        var chosen = IsConfirmation(request.Resolution) ? asked : await RepoCatalog.FindAsync(db, item.Vault, ListedRepos(request.Resolution), cancellation);

        await ConfirmAsync(db, item.PbiId.Value, item.Id, chosen, cancellation);
        await DropAsync(db, item.PbiId.Value, asked.Where(repo => chosen.All(choice => choice.Id != repo.Id)).ToList(), cancellation);
    }

    private static bool IsRepoQuestion(LocalItem item) => item.Kind == ItemKinds.Question && KeyOf(item).StartsWith(KeyPrefix, StringComparison.Ordinal);

    // The question's key lists the repos it asked about, e.g. "repos:QA-Automation-Tests,POS.Internal".
    private static List<string> AskedRepos(LocalItem item) => KeyOf(item)[KeyPrefix.Length..].Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();

    private static string KeyOf(LocalItem item)
    {
        if (item.Data is null)
            return "";

        using var data = JsonDocument.Parse(item.Data);

        return data.RootElement.TryGetProperty("key", out var key) && key.ValueKind == JsonValueKind.String ? key.GetString() ?? "" : "";
    }

    private static bool IsConfirmation(string? resolution) => Confirms().IsMatch(resolution ?? "");

    private static List<string> ListedRepos(string? resolution) => (resolution ?? "").Split([',', ';', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    private static async Task ConfirmAsync(PowerLoomDbContext db, int pbiId, string questionId, List<Repo> repos, CancellationToken cancellation)
    {
        if (repos.Count == 0)
            return;

        var ids = repos.Select(repo => repo.Id).ToList();
        var existing = await db.PbiRepos.Where(row => row.PbiId == pbiId && ids.Contains(row.RepoId)).ToListAsync(cancellation);

        foreach (var repo in repos)
            Confirm(db, existing.SingleOrDefault(row => row.RepoId == repo.Id), pbiId, repo.Id, questionId);

        await db.SaveChangesAsync(cancellation);
    }

    private static void Confirm(PowerLoomDbContext db, PbiRepo? row, int pbiId, string repoId, string questionId)
    {
        if (row is null)
            db.PbiRepos.Add(row = new PbiRepo { PbiId = pbiId, RepoId = repoId });

        row.Source = RepoSource.UserConfirmed;
        row.QuestionId = questionId;
    }

    // Guesses the user didn't keep; what the vault documents stays.
    private static async Task DropAsync(PowerLoomDbContext db, int pbiId, List<Repo> repos, CancellationToken cancellation)
    {
        if (repos.Count == 0)
            return;

        var ids = repos.Select(repo => repo.Id).ToList();

        await db.PbiRepos.Where(row => row.PbiId == pbiId && ids.Contains(row.RepoId) && row.Source != RepoSource.VaultDocumented).ExecuteDeleteAsync(cancellation);
    }

    [GeneratedRegex(@"^\s*(confirm(ed)?|yes|ok)\b", RegexOptions.IgnoreCase)]
    private static partial Regex Confirms();
}
