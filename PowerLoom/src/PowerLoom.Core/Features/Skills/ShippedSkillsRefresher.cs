using Microsoft.EntityFrameworkCore;
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

        foreach (var skill in changed)
            setting.Skills[skill.Name] = await ApplyAsync(skill, cancellation);

        var movedAny = await MoveRenamedAsync(setting, shipped, cancellation);
        if (changed.Count == 0 && !movedAny)
            return;

        await GlobalSettings.SaveAsync(db, SettingKey, setting, cancellation);
    }

    // A skill an older start shipped under a name since changed leaves PowerLoom's folder and the record, so the Skills page
    // lists one skill; the text an edit changed in it stays as a revision of the skill that took its place.
    private async Task<bool> MoveRenamedAsync(ShippedSkillsSetting setting, IReadOnlyList<ShippedSkillFile> shipped, CancellationToken cancellation)
    {
        var movedAny = false;

        foreach (var (legacy, renamed) in RenamedSkills.Names)
            if (shipped.Any(skill => skill.Name == renamed))
                movedAny |= await MoveAsync(setting, legacy, renamed, cancellation);

        return movedAny;
    }

    private async Task<bool> MoveAsync(ShippedSkillsSetting setting, string legacy, string renamed, CancellationToken cancellation)
    {
        var current = await files.ReadOwnAsync(legacy, cancellation);
        var hadRecord = setting.Skills.Remove(legacy, out var record);
        var movedHistory = await db.SkillRevisions.Where(row => row.Name == legacy)
            .ExecuteUpdateAsync(update => update.SetProperty(row => row.Name, renamed), cancellation);

        if (current is null && !hadRecord)
            return movedHistory > 0;

        var isEdited = current is not null && record?.Hash != SkillEditing.ContentHash(current);

        if (isEdited)
            await KeepEditAsync(renamed, current!, cancellation);

        files.RemoveOwn(legacy);
        logger.LogInformation("skills: {Legacy} is now {Renamed}{Kept}", legacy, renamed, isEdited ? "; the edited text is kept as a revision of it" : "");

        return true;
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
