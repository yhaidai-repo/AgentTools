using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Continue.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Api.Tests.Continue;

[Collection(PowerLoomCollection.Name)]
public sealed class OpenChatTests(PowerLoomHost host)
{
    private static string PromptOf(ChatLink link) => Uri.UnescapeDataString(link.Url.Split("&q=")[1]);

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
        Assert.Contains("## Setup", PromptOf(link));
        Assert.EndsWith("Also in the note: Rules, Notes.", PromptOf(link));
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
        Assert.Contains("## At the end", note);
        Assert.Contains("finding.submit` with `{\"itemId\":\"FND-7001\",\"adoId\":null,\"type\":\"question\",\"project\":\"adoa\"", note);
        Assert.Contains("item.close` with `{\"itemId\":\"FND-7001\",\"adoId\":null,\"decision\":\"dismiss\"", note);
        Assert.DoesNotContain("pbi.read", note);
        Assert.EndsWith("## Notes\nMy own remark.\n", note);
        Assert.DoesNotContain("stale", note);
        Assert.Contains("## The item", PromptOf(link));
        Assert.Contains("## At the end", PromptOf(link));
    }

    [Fact]
    public async Task A_finished_agent_task_gets_a_follow_up_chat_with_its_result()
    {
        await StoreAgentTaskAsync("GT-7002");

        var link = await host.Host.PostJson(new OpenChatRequest(ChatKind.Item, "GT-7002"), "/api/chats").Receive<ChatLink>();
        var note = await File.ReadAllTextAsync(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "chats", "item-GT-7002.md"));

        Assert.StartsWith("claude://code/new?", link!.Url);
        Assert.Contains("# Help me follow up on agent task GT-7002: Map the payers", note);
        Assert.Contains("**What the agent did**", note);
        Assert.Contains("Result:\n\nThree payers map to one code.", note);
        Assert.Contains("task.rerun` with `{\"itemId\":\"GT-7002\",\"adoId\":null,\"startOver\":false}`", note);
    }

    [Fact]
    public async Task A_human_task_with_steps_closes_with_one_answer_per_step()
    {
        await StoreHumanTaskAsync("HT-7003");

        await host.Host.PostJson(new OpenChatRequest(ChatKind.Item, "HT-7003"), "/api/chats").Receive<ChatLink>();
        var note = await File.ReadAllTextAsync(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "chats", "item-HT-7003.md"));

        Assert.Contains("# Help me with human task HT-7003: Check the queue", note);
        Assert.Contains("\"decision\":\"done\",\"answers\":[\"<result of step 1>\",\"<result of step 2>\"]", note);
        Assert.Contains("\"decision\":\"cancel\"", note);
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
            Kind = ItemKinds.Finding,
            Status = ItemStatus.Open,
            Body = "the finding's full text",
            Data = """{"type":"question","project":"adoa","default":[],"options":[]}""",
        });
        await db.SaveChangesAsync();
    }

    private async Task StoreHumanTaskAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.LocalItems.Add(new LocalItem
        {
            Id = id,
            Title = "Check the queue",
            Assignee = "human",
            Vault = PowerLoomHost.Vault,
            Kind = ItemKinds.Human,
            Status = ItemStatus.Open,
            Body = "Two steps.",
            Data = """{"why":"w","solves":"s","steps":[{"action":"Count","source":"sql","resource":"db","reportBack":"n"},{"action":"Clear","source":"sql","resource":"db","reportBack":"ok"}]}""",
        });
        await db.SaveChangesAsync();
    }

    private async Task StoreAgentTaskAsync(string id)
    {
        using var scope = host.Host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>();

        db.LocalItems.Add(new LocalItem
        {
            Id = id,
            Title = "Map the payers",
            Assignee = "agent:better-research",
            Vault = PowerLoomHost.Vault,
            Kind = ItemKinds.Research,
            Status = ItemStatus.Done,
            Body = "Find how payers map to codes.",
            Resolution = "Three payers map to one code.",
            HeldBy = "[]",
        });
        await db.SaveChangesAsync();
    }
}
