using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Pbis.UserNotes.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Pbis;

[Collection(PowerLoomCollection.Name)]
public sealed class UserNotesTests(PowerLoomHost host)
{
    private const string NotePath = "pbi/PBI-65001-notes/PBI-65001.md";

    [Fact]
    public async Task The_notes_section_is_read_and_saved_and_an_unseen_vault_edit_is_never_overwritten()
    {
        const int adoId = 65001;
        var file = Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, NotePath);

        await SeedAsync(adoId, NotePath);
        Directory.CreateDirectory(Path.GetDirectoryName(file)!);
        await File.WriteAllTextAsync(file, "# PBI-65001\n\nGenerated.\n\n## Notes\n\nFirst thought.\n");

        var loaded = await host.Host.GetAsJson<PbiUserNotes>($"/api/pbis/{adoId}/user-notes");
        var saved = await host.Host.PutJson(new SaveUserNotesRequest("Line one\r\nLine two\r\n", "First thought."), $"/api/pbis/{adoId}/user-notes").Receive<PbiUserNotes>();
        var afterSave = await File.ReadAllTextAsync(file);

        await File.WriteAllTextAsync(file, afterSave.Replace("Line two", "Edited in Obsidian"));

        var stale = await host.Host.Scenario(scenario =>
        {
            scenario.Put.Json(new SaveUserNotesRequest("Overwrite", "Line one\nLine two")).ToUrl($"/api/pbis/{adoId}/user-notes");
            scenario.StatusCodeShouldBe(409);
        });

        Assert.Equal("First thought.", loaded!.Text);
        Assert.Equal("Line one\nLine two", saved!.Text);
        Assert.Equal("# PBI-65001\n\nGenerated.\n\n## Notes\n\nLine one\nLine two\n", afterSave);
        Assert.Contains("changed in the vault", await stale.ReadAsTextAsync());
        Assert.Contains("Edited in Obsidian", await File.ReadAllTextAsync(file));
    }

    [Fact]
    public async Task A_pbi_without_a_note_or_unknown_to_powerloom_is_refused()
    {
        const int adoId = 65002;

        await SeedAsync(adoId, null);

        var unprepared = await host.Host.Scenario(scenario =>
        {
            scenario.Get.Url($"/api/pbis/{adoId}/user-notes");
            scenario.StatusCodeShouldBe(409);
        });

        await host.Host.Scenario(scenario =>
        {
            scenario.Get.Url("/api/pbis/65999/user-notes");
            scenario.StatusCodeShouldBe(404);
        });

        Assert.Contains("prepare it first", await unprepared.ReadAsTextAsync());
    }

    private async Task SeedAsync(int adoId, string? vaultPath)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.WorkItems.Add(new WorkItem { AdoId = adoId, Vault = PowerLoomHost.Vault, Type = "Product Backlog Item", Title = "Notes", AdoState = "Committed", Rev = 1, ContentHash = "h", Skills = "[]", ConfluencePages = "[]", PipelineStatus = PipelineStatus.New, SyncedAt = DateTime.UtcNow, VaultPath = vaultPath });

        await db.SaveChangesAsync();
    }
}
