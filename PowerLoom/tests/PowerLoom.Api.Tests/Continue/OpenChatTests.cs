using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Api.Tests.Continue;

[Collection(PowerLoomCollection.Name)]
public sealed class OpenChatTests(PowerLoomHost host)
{
    [Fact]
    public async Task The_launcher_is_available_for_every_button()
    {
        var launcher = await host.Host.GetAsJson<LauncherAvailability>("/api/chats/launcher");

        Assert.Equal("Claude", launcher!.Label);
        Assert.Null(launcher.Problem);
    }

    [Fact]
    public async Task A_vault_setup_chat_writes_its_note_and_opens_in_the_vault_s_folder()
    {
        var link = await host.Host.PostJson(new OpenChatRequest(ChatKind.Vault, PowerLoomHost.Vault), "/api/chats").Receive<ChatLink>();
        var note = await File.ReadAllTextAsync(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "chats", "vault-test-vault.md"));

        Assert.StartsWith($"claude://code/new?folder={Uri.EscapeDataString($"{PowerLoomHost.HostRoot}/test-vault")}&q=", link!.Url);
        Assert.Contains(Uri.EscapeDataString($"{PowerLoomHost.AgentTools}"), link.Url);
        Assert.Contains("# Configure the vault test-vault for Claude", note);
        Assert.Contains("## Setup", note);
        Assert.Contains("CLAUDE.md", note);
        Assert.EndsWith("## Notes\n", note);
    }

    [Fact]
    public async Task A_finding_without_a_pbi_gets_its_text_and_its_project_s_registers_and_keeps_the_user_s_notes()
    {
        await StoreFindingAsync("FND-7001");
        var notePath = Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "chats", "item-FND-7001.md");

        Directory.CreateDirectory(Path.GetDirectoryName(notePath)!);
        await File.WriteAllTextAsync(notePath, "stale\n\n## Notes\nMy own remark.\n");

        var link = await host.Host.PostJson(new OpenChatRequest(ChatKind.Item, "FND-7001"), "/api/chats").Receive<ChatLink>();
        var note = await File.ReadAllTextAsync(notePath);

        Assert.StartsWith("claude://code/new?", link!.Url);
        Assert.Contains("# Help me review finding FND-7001: Sync drops the last page", note);
        Assert.Contains("the finding's full text", note);
        Assert.Contains($"{PowerLoomHost.HostRoot}/test-vault/adoa/adoa-open-questions.md", note);
        Assert.Contains("**Recommendation**", note);
        Assert.EndsWith("## Notes\nMy own remark.\n", note);
        Assert.DoesNotContain("stale", note);
    }

    [Fact]
    public async Task An_unknown_item_is_not_found()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new OpenChatRequest(ChatKind.Item, "FND-0")).ToUrl("/api/chats");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });
    }

    private async Task StoreFindingAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.LocalItems.Add(new LocalItem
        {
            Id = id,
            Title = "Sync drops the last page",
            Assignee = "human",
            Vault = PowerLoomHost.Vault,
            Kind = ItemKind.Finding,
            Status = ItemStatus.Open,
            Body = "the finding's full text",
            Data = """{"type":"question","project":"adoa","default":[],"options":[]}""",
        });
        await db.SaveChangesAsync();
    }
}
