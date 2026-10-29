using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using PowerLoom.Features.Skills;
using PowerLoom.Features.Skills.Models;
using PowerLoom.Infrastructure.Skills;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Api.Tests.Skills;

[Collection(PowerLoomCollection.Name)]
public sealed class ShippedSkillsTests(PowerLoomHost host)
{
    private const string Checklist = "---\ndescription: The checklist\n---\n\n# Checklist v1\n";
    private const string ChecklistV2 = "---\ndescription: The checklist\n---\n\n# Checklist v2\n";
    private const string Edited = "---\ndescription: The checklist\n---\n\n# My own checklist\n";
    private const string Guide = "---\ndescription: The guide\n---\n\n# Guide\n";

    private string Own => Path.Combine(host.SkillsRoot, "shipped-own");

    private string Shipped => Path.Combine(host.SkillsRoot, "shipped-image");

    [Fact]
    public async Task A_start_puts_the_shipped_text_over_an_edit_once_keeping_the_edit_as_a_revision()
    {
        await ResetAsync();
        await WriteAsync(Shipped, "shipped-checklist", Checklist);
        await WriteAsync(Shipped, "shipped-guide", Guide);
        await WriteAsync(Own, "shipped-checklist", Edited);
        await WriteAsync(Own, "shipped-guide", Guide);

        await RefreshAsync();
        var first = await SettingAsync();

        Assert.Equal(Checklist, await ReadAsync("shipped-checklist"));
        Assert.Equal([Edited], await RevisionsAsync("shipped-checklist"));
        Assert.NotNull(first.Skills["shipped-checklist"].ReplacedRevisionId);
        Assert.Null(first.Skills["shipped-guide"].ReplacedRevisionId);
        Assert.Empty(await RevisionsAsync("shipped-guide"));
    }

    [Fact]
    public async Task An_edit_after_the_upgrade_stays_until_the_shipped_text_changes_again()
    {
        await ResetAsync();
        await WriteAsync(Shipped, "shipped-checklist", Checklist);
        await RefreshAsync();
        await WriteAsync(Own, "shipped-checklist", Edited);

        await RefreshAsync();
        var afterRestart = await ReadAsync("shipped-checklist");
        await WriteAsync(Shipped, "shipped-checklist", ChecklistV2);
        await RefreshAsync();

        Assert.Equal(Edited, afterRestart);
        Assert.Equal(ChecklistV2, await ReadAsync("shipped-checklist"));
        Assert.Equal([Edited], await RevisionsAsync("shipped-checklist"));
    }

    private async Task RefreshAsync()
    {
        var options = Options.Create(new SkillsOptions { Folders = [Own], Editable = Own, Shipped = Shipped });
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        await new ShippedSkillsRefresher(db, new SkillFiles(options), options, NullLogger<ShippedSkillsRefresher>.Instance).RefreshAsync(CancellationToken.None);
    }

    private async Task ResetAsync()
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        DeleteFolder(Own);
        DeleteFolder(Shipped);
        await GlobalSettings.DeleteAsync(db, ShippedSkillsRefresher.SettingKey, CancellationToken.None);
        await db.SkillRevisions.Where(row => row.Name.StartsWith("shipped-")).ExecuteDeleteAsync();
    }

    private static void DeleteFolder(string folder)
    {
        if (Directory.Exists(folder))
            Directory.Delete(folder, recursive: true);
    }

    private static async Task WriteAsync(string root, string name, string content)
    {
        Directory.CreateDirectory(Path.Combine(root, name));
        await File.WriteAllTextAsync(Path.Combine(root, name, "SKILL.md"), content);
    }

    private Task<string> ReadAsync(string name)
    {
        return File.ReadAllTextAsync(Path.Combine(Own, name, "SKILL.md"));
    }

    private async Task<ShippedSkillsSetting> SettingAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return (await GlobalSettings.ReadAsync<ShippedSkillsSetting>(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>(), ShippedSkillsRefresher.SettingKey, CancellationToken.None))!;
    }

    private async Task<List<string>> RevisionsAsync(string name)
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().SkillRevisions.Where(row => row.Name == name).OrderBy(row => row.Id).Select(row => row.Content).ToListAsync();
    }
}
