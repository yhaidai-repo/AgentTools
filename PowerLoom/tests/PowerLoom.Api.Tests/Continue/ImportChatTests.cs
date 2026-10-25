using System.Net;
using Alba;
using PowerLoom.Features.Continue.Models;

namespace PowerLoom.Api.Tests.Continue;

[Collection(PowerLoomCollection.Name)]
public sealed class ImportChatTests(PowerLoomHost host)
{
    private const string Source = @"D:\Docs\Old specs";

    private static string PromptOf(ChatLink link) => Uri.UnescapeDataString(link.Url.Split("&q=")[1]);

    [Fact]
    public async Task An_import_chat_opens_in_the_vault_adds_the_source_folder_and_asks_for_a_report_a_summary_and_what_the_vault_is_about()
    {
        var link = await host.Host.PostJson(new OpenChatRequest(ChatKind.Import, PowerLoomHost.Vault, Source), "/api/chats").Receive<ChatLink>();
        var note = await File.ReadAllTextAsync(Path.Combine(host.BacklogRoot, PowerLoomHost.Vault, "chats", "import-test-vault.md"));
        var folder = $"{PowerLoomHost.HostRoot}/test-vault";

        Assert.StartsWith($"claude://code/new?folder={Uri.EscapeDataString(folder)}&q=", link!.Url);
        Assert.Contains($"Add these folders to this session: {Source}", PromptOf(link));
        Assert.Contains("# Import Old specs into the vault test-vault", note);
        Assert.Contains($"[[AGENTS]] `{folder}/AGENTS.md`", note);
        Assert.Contains($"{folder}/import-reports/", note);
        Assert.Contains("-old-specs.md", note);
        Assert.Contains("wait for the user's yes", note);
        Assert.Contains("batches of about 10 files", note);
        Assert.Contains("## What this vault is about", note);
        Assert.Contains("ask whether to put the vault's description at the top of index.md", note);
        Assert.Contains($"Read from {Source} only", note);
    }

    [Fact]
    public async Task An_import_without_a_folder_or_of_an_unknown_vault_is_refused()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new OpenChatRequest(ChatKind.Import, PowerLoomHost.Vault, "  ")).ToUrl("/api/chats");
            scenario.StatusCodeShouldBe(HttpStatusCode.BadRequest);
        });
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(new OpenChatRequest(ChatKind.Import, "no-such-vault", Source)).ToUrl("/api/chats");
            scenario.StatusCodeShouldBe(HttpStatusCode.NotFound);
        });
    }
}
