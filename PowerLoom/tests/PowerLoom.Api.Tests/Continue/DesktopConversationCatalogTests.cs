using System.Text.Json;
using Microsoft.Extensions.Options;
using PowerLoom.Infrastructure.ChatLaunch;

namespace PowerLoom.Api.Tests.Continue;

public sealed class DesktopConversationCatalogTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "powerloom-chat-catalog", Guid.NewGuid().ToString("N"));
    private const string Id = "11111111-1111-4111-8111-111111111111";

    [Fact]
    public async Task Claude_lists_only_valid_unarchived_root_sessions_and_survives_partial_writes()
    {
        var folder = Path.Combine(_root, "account", "organization");
        Directory.CreateDirectory(folder);
        await File.WriteAllTextAsync(Path.Combine(folder, "local_good.json"), JsonSerializer.Serialize(new { sessionId = "local_" + Id, title = "A desktop chat", cwd = "D:/repo", lastActivityAt = 1793200000000, isArchived = false }));
        await File.WriteAllTextAsync(Path.Combine(folder, "local_archived.json"), JsonSerializer.Serialize(new { sessionId = "local_22222222-2222-4222-8222-222222222222", isArchived = true }));
        await File.WriteAllTextAsync(Path.Combine(folder, "local_subagent.json"), JsonSerializer.Serialize(new { sessionId = "local_33333333-3333-4333-8333-333333333333", spawnedFrom = "parent" }));
        await File.WriteAllTextAsync(Path.Combine(folder, "local_partial.json"), "{\"sessionId\":");
        await File.WriteAllTextAsync(Path.Combine(folder, "local_bad_id.json"), """{"sessionId":"local_../../escape"}""");

        var catalog = new DesktopConversationCatalog(Options.Create(new ChatOptions { ClaudeSessionsRoot = _root }));
        var result = await catalog.ReadAsync(ClaudeDesktopLauncher.LauncherId, CancellationToken.None);
        Assert.True(result.Ok);
        var chat = Assert.Single(result.Value);

        Assert.Equal(("local_" + Id, "A desktop chat", "D:/repo"), (chat.Id, chat.Title, chat.Folder));
        Assert.Equal(DateTimeOffset.FromUnixTimeMilliseconds(1793200000000), chat.UpdatedAt);
    }

    [Fact]
    public async Task Codex_uses_latest_titles_and_reads_only_the_header_excluding_subagents_and_archives()
    {
        var sessions = Path.Combine(_root, "sessions", "2026", "10", "29");
        Directory.CreateDirectory(sessions);
        await File.WriteAllTextAsync(Path.Combine(_root, "session_index.jsonl"), $"{{\"id\":\"{Id}\",\"thread_name\":\"Old name\"}}\n{{\"id\":\"{Id}\",\"thread_name\":\"New name\"}}\n{{partial");
        var header = JsonSerializer.Serialize(new { type = "session_meta", payload = new { id = Id, cwd = "D:/repo", source = "cli" } });
        await File.WriteAllTextAsync(Path.Combine(sessions, "rollout-main.jsonl"), header + "\nTHIS IS NOT JSON AND MUST NOT BE PARSED AS METADATA");
        await File.WriteAllTextAsync(Path.Combine(sessions, "rollout-child.jsonl"), JsonSerializer.Serialize(new { type = "session_meta", payload = new { id = "22222222-2222-4222-8222-222222222222", parent_thread_id = Id, source = new { subagent = "reviewer" } } }));
        var archived = Path.Combine(_root, "archived_sessions");
        Directory.CreateDirectory(archived);
        await File.WriteAllTextAsync(Path.Combine(archived, "rollout-archived.jsonl"), header);

        var catalog = new DesktopConversationCatalog(Options.Create(new ChatOptions { CodexHistoryRoot = _root }));
        var result = await catalog.ReadAsync(CodexDesktopLauncher.LauncherId, CancellationToken.None);
        Assert.True(result.Ok);
        var chat = Assert.Single(result.Value);

        Assert.Equal((Id, "New name", "D:/repo"), (chat.Id, chat.Title, chat.Folder));
    }

    [Fact]
    public async Task Missing_history_is_a_clear_configuration_problem()
    {
        var catalog = new DesktopConversationCatalog(Options.Create(new ChatOptions { ClaudeSessionsRoot = _root }));
        var result = await catalog.ReadAsync(ClaudeDesktopLauncher.LauncherId, CancellationToken.None);

        Assert.False(result.Ok);
        Assert.Contains("Set-DesktopChatHistory.ps1", result.Problem.Detail);
    }

    [Fact]
    public async Task Explicit_user_forks_remain_selectable_in_both_apps()
    {
        Directory.CreateDirectory(_root);
        var claude = new { sessionId = "local_" + Id, title = "User fork", spawnedFrom = new { sideSession = true, userFork = true } };
        await File.WriteAllTextAsync(Path.Combine(_root, "local_fork.json"), JsonSerializer.Serialize(claude));
        var sessions = Path.Combine(_root, "sessions");
        Directory.CreateDirectory(sessions);
        var codex = new { type = "session_meta", payload = new { id = Id, parent_thread_id = "parent", source = "cli" } };
        await File.WriteAllTextAsync(Path.Combine(sessions, "rollout-fork.jsonl"), JsonSerializer.Serialize(codex));
        var catalog = new DesktopConversationCatalog(Options.Create(new ChatOptions { ClaudeSessionsRoot = _root, CodexHistoryRoot = _root }));
        var claudeResult = await catalog.ReadAsync(ClaudeDesktopLauncher.LauncherId, CancellationToken.None);
        var codexResult = await catalog.ReadAsync(CodexDesktopLauncher.LauncherId, CancellationToken.None);

        Assert.True(claudeResult.Ok);
        Assert.True(codexResult.Ok);
        Assert.Equal("local_" + Id, Assert.Single(claudeResult.Value).Id);
        Assert.Equal(Id, Assert.Single(codexResult.Value).Id);
    }

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }
}
