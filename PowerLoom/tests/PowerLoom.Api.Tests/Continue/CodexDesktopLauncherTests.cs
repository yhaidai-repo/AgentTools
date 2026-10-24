using PowerLoom.Infrastructure.ChatLaunch;
using PowerLoom.Infrastructure.ChatLaunch.Models;

namespace PowerLoom.Api.Tests.Continue;

public sealed class CodexDesktopLauncherTests
{
    [Fact]
    public void Open_escapes_the_folder_and_prompt_and_preserves_the_step_order()
    {
        var request = RequestWith("Short version");
        var opened = new CodexDesktopLauncher().Open(request);

        Assert.True(opened.Ok);
        Assert.StartsWith("codex://new?path=D%3A%2Fwork%20%26%20notes&prompt=", opened.Value!.Url);
        Assert.Equal("Title\nIntro\n1. Work in these folders too (absolute paths): D:/extra.\n2. Prepare.\n3. Read D:/note.md and follow its Start section. Its short version, for you and me:\n\n---\n\nShort version", PromptOf(opened.Value));
    }

    [Fact]
    public void Open_omits_an_oversized_short_version()
    {
        var opened = new CodexDesktopLauncher().Open(RequestWith(new string('x', 20_000)));

        Assert.True(opened.Ok);
        Assert.EndsWith("Read D:/note.md and follow its Start section.", PromptOf(opened.Value!));
        Assert.DoesNotContain("xxx", PromptOf(opened.Value!));
    }

    [Fact]
    public void Open_rejects_steps_that_exceed_the_limit_even_without_the_short_version()
    {
        var request = RequestWith("short") with { Steps = [new string('x', 15_000)] };

        Assert.False(new CodexDesktopLauncher().Open(request).Ok);
    }

    [Fact]
    public void Open_has_no_extra_folder_step_when_there_are_no_extra_folders()
    {
        var request = RequestWith("short") with { ExtraFolders = [] };
        var opened = new CodexDesktopLauncher().Open(request);

        Assert.True(opened.Ok);
        Assert.StartsWith("Title\nIntro\n1. Prepare.\n2. Read", PromptOf(opened.Value!));
    }

    [Fact]
    public void Setup_copies_the_global_rules_and_the_skills_where_Codex_reads_them_and_asks_before_overwriting()
    {
        var steps = new CodexDesktopLauncher().VaultSetupSteps("D:/vault", "D:/tools");
        var rules = steps.Single(step => step.Contains("~/.codex/AGENTS.md"));
        var skills = steps.Single(step => step.Contains("~/.agents/skills"));

        Assert.Contains("~/.claude/CLAUDE.md", rules);
        Assert.Contains("ask before adding", rules);
        Assert.Contains("Never remove", rules);
        Assert.Contains("~/.claude/skills", skills);
        Assert.Contains("create-branch and www-record", skills);
        Assert.Contains("ask me before overwriting", skills);
        Assert.True(steps.ToList().IndexOf(skills) < steps.ToList().FindIndex(step => step.Contains("status_get")), "the skills are in place before the connection check");
    }

    [Fact]
    public void Setup_names_both_hooks_trust_and_the_connection_check()
    {
        var launcher = new CodexDesktopLauncher();
        var steps = string.Join("\n", launcher.VaultSetupSteps("D:/vault", "D:/tools"));

        Assert.Equal("codex-desktop", launcher.Id);
        Assert.Equal("Codex", launcher.Label);
        Assert.Contains("~/.codex/hooks.json", steps);
        Assert.Contains("D:/tools/VaultUsage/Adapters/Codex/Invoke-CodexHook.ps1", steps);
        Assert.Contains("D:/tools/VaultCapture/Adapters/Codex/Invoke-ContextLimitHook.ps1", steps);
        Assert.Contains("/hooks", steps);
        Assert.Contains("D:/vault", steps);
        Assert.Contains(".codex/config.toml", steps);
        Assert.Contains("status_get", steps);
        // The vault's CLAUDE.md is Claude Code's to create; Codex setup only reads the global one to copy it.
        Assert.DoesNotContain("D:/vault/CLAUDE.md", steps);
    }

    private static ChatRequest RequestWith(string shortVersion)
    {
        return new ChatRequest("Title", ["Intro"], "D:/work & notes", ["D:/extra"], ["Prepare."], new ChatHandoff("D:/note.md", shortVersion));
    }

    private static string PromptOf(OpenedChat opened)
    {
        return Uri.UnescapeDataString(opened.Url.Split("&prompt=")[1]);
    }
}
