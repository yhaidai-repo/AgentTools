using Microsoft.Extensions.Options;
using PowerLoom.Features.Skills.Models;
using PowerLoom.Infrastructure.Skills;
using PowerLoom.Infrastructure.Skills.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Features.Skills;

// Shipped skills run on the shipped text (release decision 2026-10-29). At start, each skill whose shipped text differs
// from the one the last start applied (or that has no record yet) is written into PowerLoom's own skills folder; an
// edited text it replaces is kept as a revision first, to restore from the skill's page. While the shipped text stays
// the same, an edit made on the Skills page stays what runs.
public sealed class ShippedSkillsRefresher(PowerLoomDbContext db, SkillFiles files, IOptions<SkillsOptions> options, ILogger<ShippedSkillsRefresher> logger)
{
    // Read by core's loadShippedSkill (SHIPPED_SKILLS_KEY) for the skill's page.
    public const string SettingKey = "skills:shipped";

    public async Task RefreshAsync(CancellationToken cancellation)
    {
        var shipped = await files.ShippedAsync(cancellation);
        var setting = await GlobalSettings.ReadAsync<ShippedSkillsSetting>(db, SettingKey, cancellation) ?? new ShippedSkillsSetting([]);
        var changed = shipped.Where(skill => !IsApplied(setting, skill)).ToList();

        if (changed.Count == 0)
            return;

        foreach (var skill in changed)
            setting.Skills[skill.Name] = await ApplyAsync(skill, cancellation);

        await GlobalSettings.SaveAsync(db, SettingKey, setting, cancellation);
    }

    private static bool IsApplied(ShippedSkillsSetting setting, ShippedSkillFile skill)
    {
        return setting.Skills.TryGetValue(skill.Name, out var record) && record.Hash == SkillEditing.ContentHash(skill.Content);
    }

    private async Task<ShippedSkillRecord> ApplyAsync(ShippedSkillFile skill, CancellationToken cancellation)
    {
        var current = await files.ReadOwnAsync(skill.Name, cancellation);
        var record = new ShippedSkillRecord(SkillEditing.ContentHash(skill.Content), DateTime.UtcNow, null);

        if (current == skill.Content)
            return record;

        var revisionId = current is null ? (int?)null : await KeepEditAsync(skill.Name, current, cancellation);

        await files.WriteShippedAsync(skill, cancellation);
        logger.LogInformation("skills: {Name} takes the shipped text{Kept}", skill.Name, revisionId is null ? "" : $"; the edited text is revision {revisionId}");

        return record with { ReplacedRevisionId = revisionId };
    }

    private async Task<int> KeepEditAsync(string name, string content, CancellationToken cancellation)
    {
        var revision = new SkillRevision { Name = name, Folder = options.Value.Editable, Content = content };

        db.SkillRevisions.Add(revision);
        await db.SaveChangesAsync(cancellation);

        return revision.Id;
    }
}
