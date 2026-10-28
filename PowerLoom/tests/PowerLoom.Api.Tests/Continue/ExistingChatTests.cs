using System.Net;
using System.Text.Json;
using Alba;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Infrastructure.ChatLaunch.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;
using PowerLoom.Persistence.Settings;

namespace PowerLoom.Api.Tests.Continue;

[Collection(PowerLoomCollection.Name)]
public sealed class ExistingChatTests(PowerLoomHost host) : IAsyncLifetime
{
    private const string Id = "11111111-1111-4111-8111-111111111111";
    private const string LocalId = "local_" + Id;

    public Task InitializeAsync() => ChooseAsync(ClaudeDesktopLauncher.LauncherId);
    public Task DisposeAsync() => ChooseAsync(ClaudeDesktopLauncher.LauncherId);

    [Fact]
    public async Task Catalog_search_prioritizes_this_project_and_does_not_prepare_a_handoff()
    {
        await FindingAsync("FND-EXISTING-LIST");
        await ClaudeAsync(LocalId, "Project discussion", PowerLoomHost.HostRoot + "/test-vault", 1790000000000);
        await ClaudeAsync("local_22222222-2222-4222-8222-222222222222", "Unrelated discussion", "D:/elsewhere", 1793200000000);

        var choices = await host.Host.GetAsJson<ChatConversationChoices>("/api/chats/conversations?kind=item&id=FND-EXISTING-LIST&search=discussion");

        Assert.Equal(LocalId, choices!.Conversations[0].Id);
        Assert.True(choices.Conversations[0].IsRelated);
        Assert.False(File.Exists(Note("FND-EXISTING-LIST")));
        var filtered = await host.Host.GetAsJson<ChatConversationChoices>("/api/chats/conversations?kind=item&id=FND-EXISTING-LIST&search=Unrelated");
        Assert.Equal("Unrelated discussion", Assert.Single(filtered!.Conversations).Title);
    }

    [Fact]
    public async Task Claude_returns_clipboard_prompt_and_preserves_existing_handoff_bytes_and_timestamp()
    {
        const string item = "FND-EXISTING-CLAUDE";
        await FindingAsync(item);
        await ClaudeAsync(LocalId, "Existing chat", "D:/repo");
        Directory.CreateDirectory(Path.GetDirectoryName(Note(item))!);
        const string original = "# My existing handoff\n\n## Start\nRead my note.\n\n## Notes\nMy own remark.\n";
        await File.WriteAllTextAsync(Note(item), original);
        File.SetLastWriteTimeUtc(Note(item), new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var modified = File.GetLastWriteTimeUtc(Note(item));

        var link = await host.Host.PostJson(new OpenChatRequest(ChatKind.Item, item, Destination: new(ClaudeDesktopLauncher.LauncherId, LocalId)), "/api/chats").Receive<ChatLink>();

        Assert.Equal("claude://code/continue?session=" + LocalId, link!.Url);
        Assert.Contains("Read D:/pc/powerloom-backlog/test-vault/chats/item-" + item + ".md", link.ClipboardText);
        Assert.Equal(original, await File.ReadAllTextAsync(Note(item)));
        Assert.Equal(modified, File.GetLastWriteTimeUtc(Note(item)));
    }

    [Fact]
    public async Task Codex_prefills_the_selected_conversation_and_creates_a_missing_handoff_once()
    {
        const string item = "FND-EXISTING-CODEX";
        await FindingAsync(item);
        await ChooseAsync(CodexDesktopLauncher.LauncherId);
        await CodexAsync();
        var request = new OpenChatRequest(ChatKind.Item, item, Destination: new(CodexDesktopLauncher.LauncherId, Id));

        var link = await host.Host.PostJson(request, "/api/chats").Receive<ChatLink>();

        Assert.StartsWith("codex://threads/" + Id + "?prompt=", link!.Url);
        Assert.Null(link.ClipboardText);
        Assert.Contains("Read D:/pc/powerloom-backlog/test-vault/chats/item-" + item + ".md", Uri.UnescapeDataString(link.Url));
        var content = await File.ReadAllTextAsync(Note(item));
        var modified = File.GetLastWriteTimeUtc(Note(item));
        await host.Host.PostJson(request, "/api/chats").Receive<ChatLink>();
        Assert.Equal(content, await File.ReadAllTextAsync(Note(item)));
        Assert.Equal(modified, File.GetLastWriteTimeUtc(Note(item)));
    }

    [Theory]
    [InlineData("codex-desktop", "11111111-1111-4111-8111-111111111111", HttpStatusCode.Conflict)]
    [InlineData("claude-desktop", "local_99999999-9999-4999-8999-999999999999", HttpStatusCode.NotFound)]
    [InlineData("claude-desktop", "local_../../escape", HttpStatusCode.NotFound)]
    public async Task An_invalid_selection_cannot_write_a_note_or_start_development(string launcher, string conversation, HttpStatusCode status)
    {
        const int pbiId = 31991;
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        if (!await db.WorkItems.AnyAsync(row => row.AdoId == pbiId))
        {
            db.WorkItems.Add(new WorkItem { AdoId = pbiId, Type = "Product Backlog Item", Title = "Do not start", AdoState = "New", ContentHash = "test", Vault = PowerLoomHost.Vault, PipelineStatus = PipelineStatus.ReadyForDev });
            await db.SaveChangesAsync();
        }

        await host.Host.Scenario(s =>
        {
            s.Post.Json(new OpenChatRequest(ChatKind.Pbi, pbiId.ToString(), Destination: new(launcher, conversation))).ToUrl("/api/chats");
            s.StatusCodeShouldBe(status);
        });

        Assert.Equal(PipelineStatus.ReadyForDev, (await db.WorkItems.AsNoTracking().SingleAsync(row => row.AdoId == pbiId)).PipelineStatus);
        Assert.False(File.Exists(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "chats", $"pbi-{pbiId}.md")));
    }

    [Fact]
    public async Task Vault_configuration_keeps_the_new_chat_contract()
    {
        await host.Host.Scenario(s =>
        {
            s.Post.Json(new OpenChatRequest(ChatKind.Vault, PowerLoomHost.Vault, Destination: new(ClaudeDesktopLauncher.LauncherId, LocalId))).ToUrl("/api/chats");
            s.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });
    }

    private string Note(string item) => Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "chats", $"item-{item}.md");

    private async Task ChooseAsync(string launcher)
    {
        using var scope = host.Host.Services.CreateScope();
        await GlobalSettings.SaveAsync(scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>(), ChatLaunchers.SettingKey, new ChatAppSetting { Launcher = launcher }, CancellationToken.None);
    }

    private async Task FindingAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();
        db.LocalItems.Add(new LocalItem { Id = id, Title = "Continue this discussion", Assignee = "human", Vault = PowerLoomHost.Vault, Kind = ItemKinds.Finding, Status = ItemStatus.Open, Body = "Finding", Data = """{"type":"question","project":"adoa","default":[],"options":[]}""" });
        await db.SaveChangesAsync();
    }

    private Task ClaudeAsync(string id, string title, string folder, long updatedAt = 1793200000000) => File.WriteAllTextAsync(Path.Combine(host.DesktopRoot, "claude", id + ".json"), JsonSerializer.Serialize(new { sessionId = id, title, cwd = folder, lastActivityAt = updatedAt, isArchived = false }));

    private async Task CodexAsync()
    {
        var header = JsonSerializer.Serialize(new { type = "session_meta", payload = new { id = Id, cwd = "D:/repo", source = "cli" } });
        await File.WriteAllTextAsync(Path.Combine(host.DesktopRoot, "codex", "sessions", "rollout-" + Id + ".jsonl"), header);
        await File.WriteAllTextAsync(Path.Combine(host.DesktopRoot, "codex", "session_index.jsonl"), JsonSerializer.Serialize(new { id = Id, thread_name = "Existing Codex chat" }));
    }
}
