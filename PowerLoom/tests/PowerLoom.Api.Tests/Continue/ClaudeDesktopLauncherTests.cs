using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Infrastructure.ChatLaunch.Models;

namespace PowerLoom.Api.Tests.Continue;

// The handoff note's short version is shown in the chat (user decision 2026-10-24); one too long for the link is left out.
public sealed class ClaudeDesktopLauncherTests
{
    private const string NotePath = "D:/pc/powerloom-backlog/test-vault/chats/pbi-1.md";

    [Fact]
    public void The_prompt_shows_the_note_s_short_version_after_the_steps()
    {
        var prompt = PromptOf(new ClaudeDesktopLauncher().Open(RequestWith("# Implement PBI-1\n\n## Start\n\n1. Brief me.")));

        Assert.StartsWith("Implement PBI-1\n1. Add these folders to this session: D:/pc/repos/PVS.\n2. Read " + NotePath + " and follow its Start section. Its short version, for you and me:", prompt);
        Assert.EndsWith("\n\n---\n\n# Implement PBI-1\n\n## Start\n\n1. Brief me.", prompt);
    }

    [Fact]
    public void A_note_too_long_for_the_link_is_read_from_its_file()
    {
        var prompt = PromptOf(new ClaudeDesktopLauncher().Open(RequestWith(new string('x', 20_000))));

        Assert.EndsWith($"2. Read {NotePath} and follow its Start section.", prompt);
        Assert.DoesNotContain("xxx", prompt);
    }

    private static ChatRequest RequestWith(string noteText)
    {
        return new ChatRequest("Implement PBI-1", [], "D:/pc/work-projects", ["D:/pc/repos/PVS"], [], new ChatHandoff(NotePath, noteText));
    }

    private static string PromptOf(PowerLoom.Contracts.Outcome<OpenedChat> opened)
    {
        Assert.True(opened.Ok);

        return Uri.UnescapeDataString(opened.Value!.Url.Split("&q=")[1]);
    }
}
