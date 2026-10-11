using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Pbis.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Domain.Pbis;

// Each PBI skill adds its description to every later agent's prompt on the PBI (user decision 2026-10-01: at most 5).
public static class PbiSkills
{
    public const int Max = 5;

    private const string AdoaPrefix = "adoa-";
    private const string User = "user";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    // adoa's own skills are configured per agent, so they're never recommended per PBI (assumption: the prefix marks
    // them).
    public static bool IsRecommendable(string name) => !name.StartsWith(AdoaPrefix, StringComparison.Ordinal);

    // What's wrong with a PBI skill list, checked against the skills the folders have (empty = fine).
    public static List<string> Problems(IReadOnlyList<string> names, IReadOnlySet<string> available)
    {
        var duplicates = names.Where((name, index) => names.Take(index).Contains(name)).ToList();
        var problems = new List<string>();

        if (names.Count > Max)
            problems.Add($"at most {Max} skills");

        if (duplicates.Count > 0)
            problems.Add($"listed twice: {string.Join(", ", duplicates)}");

        problems.AddRange(names.Where(name => !IsRecommendable(name)).Select(name => $"{name} is configured per agent, not per PBI"));
        problems.AddRange(names.Where(name => IsRecommendable(name) && !available.Contains(name)).Select(name => $"no skill named {name}"));

        return problems;
    }

    // The user's edited list wins from now on (later refinements leave it); a skill kept from the earlier list keeps who
    // added it.
    public static async Task SaveChoicesAsync(PowerLoomDbContext db, int adoId, IReadOnlyList<SkillChoice> choices, CancellationToken cancellation)
    {
        var pbi = await db.WorkItems.SingleAsync(row => row.AdoId == adoId, cancellation);
        var earlier = JsonSerializer.Deserialize<List<PbiSkill>>(pbi.Skills, Json) ?? [];
        var skills = choices.Select(choice => new PbiSkill(choice.Name, choice.Reason, earlier.FirstOrDefault(skill => skill.Name == choice.Name)?.By ?? User)).ToList();

        pbi.Skills = JsonSerializer.Serialize(skills, Json);
        pbi.SkillsEditedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellation);
    }
}
