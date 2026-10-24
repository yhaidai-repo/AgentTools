using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Skills;
using PowerLoom.Features.Skills.Models;
using PowerLoom.Persistence;

namespace PowerLoom.Api.Tests.Skills;

[Collection(PowerLoomCollection.Name)]
public sealed class SkillsTests(PowerLoomHost host)
{
    private const string Original = "---\ndescription: Reviews code\n---\n\n# Review\n";
    private const string Edited = "---\ndescription: Reviews code well\n---\n\n# Review v2\n";

    [Fact]
    public async Task A_save_keeps_the_old_version_refuses_a_stale_hash_and_a_restore_brings_it_back()
    {
        var file = Path.Combine(host.SkillsRoot, "own", "my-skill", "SKILL.md");

        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        Directory.CreateDirectory(Path.Combine(host.SkillsRoot, "other", "their-skill"));
        await File.WriteAllTextAsync(file, Original);
        await File.WriteAllTextAsync(Path.Combine(host.SkillsRoot, "other", "their-skill", "SKILL.md"), Original);

        var stale = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveSkillRequest(Edited, "nope")).ToUrl("/api/skills/my-skill");
            scenario.StatusCodeShouldBe(409);
        });
        var foreign = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveSkillRequest(Edited, SkillEditing.ContentHash(Original))).ToUrl("/api/skills/their-skill");
            scenario.StatusCodeShouldBe(400);
        });
        var saved = await host.Host.PutJson(new SaveSkillRequest(Edited, SkillEditing.ContentHash(Original)), "/api/skills/my-skill").Receive<SavedSkill>();
        var revisionId = await RevisionIdAsync();
        var restored = await host.Host.PostJson(new RestoreRequest(SkillEditing.ContentHash(Edited)), $"/api/skills/my-skill/revisions/{revisionId}/restore").Receive<SavedSkill>();

        Assert.Contains("changed since you opened it", await stale.ReadAsTextAsync());
        Assert.Contains("isn't one of PowerLoom's own skills", await foreign.ReadAsTextAsync());
        Assert.True(saved!.Changed);
        Assert.True(restored!.Changed && restored.RestoredFrom is not null);
        Assert.Equal(Original, await File.ReadAllTextAsync(file));
        Assert.Equal(2, await RevisionCountAsync());
    }

    private async Task<int> RevisionIdAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().SkillRevisions.Where(row => row.Name == "my-skill").OrderBy(row => row.Id).Select(row => row.Id).FirstAsync();
    }

    private async Task<int> RevisionCountAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().SkillRevisions.CountAsync(row => row.Name == "my-skill");
    }
}
