using System.Net;
using Alba;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Api.Tests.Probes;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Infrastructure.VaultCapture.Models;

namespace PowerLoom.Api.Tests.Docs;

[Collection(PowerLoomCollection.Name)]
public sealed class ChatRecordsTests(PowerLoomHost host)
{
    private const string VaultApi = $"/api/vaults/{PowerLoomHost.Vault}";
    private const string IssuesPath = "chatp/chatp-known-issues.md";

    private FakeVaultCapture Capture => host.Host.Services.GetRequiredService<FakeVaultCapture>();

    [Fact]
    public async Task A_chat_s_draft_goes_to_VaultCapture_at_once_and_a_rejected_one_answers_its_errors()
    {
        var written = await host.Host.PostJson(Draft("chatp-sync-paging"), $"{VaultApi}/drafts").Receive<DraftCaptureResult>();
        var rejected = await host.Host.PostJson(Draft("reject-topic"), $"{VaultApi}/drafts").Receive<DraftCaptureResult>();

        Assert.True(written!.Ok);
        Assert.Equal("draft/chatp-sync-paging.md", written.Path);
        Assert.Empty(written.Errors);
        Assert.False(rejected!.Ok);
        Assert.Equal(["unknown target"], rejected.Errors);
        Assert.Contains(Capture.Captured, entry => entry.Vault == PowerLoomHost.Vault && entry.Draft.Source == "session finding: powerloom chat CHAT-1" && entry.Draft.Assumptions.Count == 0);
    }

    [Fact]
    public async Task A_chat_s_register_record_is_added_and_a_wrong_kind_or_a_refusal_is_a_problem()
    {
        var added = await host.Host.PostJson(new AddRegisterRecordRequest("chatp", "questions", "Which rate applies?", "Finance decides.", ["the old rate"], null), $"{VaultApi}/register-records").Receive<AddedRegisterRecord>();

        await ShouldFailAsync($"{VaultApi}/register-records", new AddRegisterRecordRequest("chatp", "notes", "x", "y", null, null), HttpStatusCode.BadRequest);
        await ShouldFailAsync($"{VaultApi}/register-records", new AddRegisterRecordRequest("chatp", "issues", "reject: x", "y", null, null), HttpStatusCode.BadRequest);

        Assert.Equal(new AddedRegisterRecord(FakeVaultCapture.RecordId), added);
    }

    [Fact]
    public async Task Closing_writes_the_register_once_and_refuses_a_closed_record_a_fixed_question_and_a_duplicate_without_its_original()
    {
        await WriteRegisterAsync("# Known issues\n\n## KI-001 Sync drops a page\n\n> **Open** · Created 2026-10-01\n\nLost.\n\n## KI-002 Same drop\n\n> **Open** · Created 2026-10-02\n\nLost too.\n");

        var closed = await host.Host.PostJson(new CloseRegisterRecordRequest(IssuesPath, "KI-001", "fixed", null, "Fixed by PBI-38519.", "the user in a chat"), $"{VaultApi}/register-records/close").Receive<ClosedRegisterRecord>();
        var text = await File.ReadAllTextAsync(Path.Combine(host.VaultRoot, IssuesPath));

        await ShouldFailAsync($"{VaultApi}/register-records/close", new CloseRegisterRecordRequest(IssuesPath, "KI-001", "resolved", null, "again", "the user"), HttpStatusCode.NotFound);
        await ShouldFailAsync($"{VaultApi}/register-records/close", new CloseRegisterRecordRequest(IssuesPath, "KI-002", "duplicate", null, "same", "the user"), HttpStatusCode.BadRequest);
        await ShouldFailAsync($"{VaultApi}/register-records/close", new CloseRegisterRecordRequest("notes/elsewhere.md", "KI-002", "resolved", null, "x", "the user"), HttpStatusCode.NotFound);

        Assert.Equal(new ClosedRegisterRecord(IssuesPath, "KI-001", "fixed"), closed);
        Assert.Contains("## [RESOLVED] KI-001 Sync drops a page\n\n> **Fixed**", text);
        Assert.Contains("**Decision** (the user in a chat, ", text);
        Assert.Contains("## KI-002 Same drop\n\n> **Open**", text);
    }

    [Fact]
    public async Task A_duplicate_names_the_record_it_repeats()
    {
        await WriteRegisterAsync("# Known issues\n\n## KI-001 Sync drops a page\n\n> **Open** · Created 2026-10-01\n\nLost.\n\n## KI-002 Same drop\n\n> **Open** · Created 2026-10-02\n\nLost too.\n");

        await host.Host.PostJson(new CloseRegisterRecordRequest(IssuesPath, "KI-002", "duplicate", new RecordRef(IssuesPath, "KI-001"), "Same page loss.", "the user in a chat"), $"{VaultApi}/register-records/close").Receive<ClosedRegisterRecord>();
        var text = await File.ReadAllTextAsync(Path.Combine(host.VaultRoot, IssuesPath));

        Assert.Contains("## [RESOLVED] KI-002 Same drop\n\n> **Resolved**", text);
        Assert.Contains("): Duplicate of KI-001. Same page loss.", text);
    }

    [Fact]
    public async Task A_path_outside_the_vault_is_refused_and_a_close_leaves_no_lock_behind()
    {
        await WriteRegisterAsync("# Known issues\n\n## KI-001 Sync drops a page\n\n> **Open** · Created 2026-10-01\n\nLost.\n");

        await ShouldFailAsync($"{VaultApi}/register-records/close", new CloseRegisterRecordRequest("../chatp/chatp-known-issues.md", "KI-001", "fixed", null, "x", "the user"), HttpStatusCode.BadRequest);
        await ShouldFailAsync($"{VaultApi}/register-records/close", new CloseRegisterRecordRequest(IssuesPath, "KI-001", "duplicate", new RecordRef("../x/x-known-issues.md", "KI-009"), "x", "the user"), HttpStatusCode.BadRequest);
        await host.Host.PostJson(new CloseRegisterRecordRequest(IssuesPath, "KI-001", "fixed", null, "Fixed.", "the user"), $"{VaultApi}/register-records/close").Receive<ClosedRegisterRecord>();

        Assert.False(File.Exists(Path.Combine(host.VaultRoot, "chatp", ".chatp-known-issues.md.lock")));
    }

    private static CaptureDraftRequest Draft(string name) => new("chatp", name, "Sync paging", "[[chatp-sync]]", ["The sync reads 200 items a page."], null, ["Is 200 configurable?"], "session finding: powerloom chat CHAT-1");

    private async Task WriteRegisterAsync(string text)
    {
        var path = Path.Combine(host.VaultRoot, IssuesPath);

        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await File.WriteAllTextAsync(path, text);
    }

    private async Task ShouldFailAsync(string url, object body, HttpStatusCode status)
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Post.Json(body).ToUrl(url);
            scenario.StatusCodeShouldBe(status);
        });
    }
}
