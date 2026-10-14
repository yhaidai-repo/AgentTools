using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PowerLoom.Features.Meetings.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using Wolverine;
using Wolverine.Tracking;

namespace PowerLoom.Api.Tests.Meetings;

// A meeting the audio-capture tool dropped into <inbox>/meetings becomes a transcript note in the vault and a `meeting`
// task for any agent taking the type; the same meeting is never imported twice.
[Collection(PowerLoomCollection.Name)]
public sealed class MeetingImportTests(PowerLoomHost host)
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);
    private const string SourceRef = "2026-10-14_1926-backlog-refinement";

    [Fact]
    public async Task A_meeting_file_becomes_a_transcript_note_and_a_meeting_task_once()
    {
        var folder = Path.Combine(host.ImportRoot, "meetings");

        Directory.CreateDirectory(folder);
        await File.WriteAllTextAsync(Path.Combine(folder, $"{SourceRef}.json"), MeetingJson());
        await File.WriteAllTextAsync(Path.Combine(folder, "broken.json"), "{not json");
        await File.WriteAllTextAsync(Path.Combine(folder, "no-transcript.json"), """{"source":"audio-capture","sourceRef":"x","title":"T","startedAt":"2026-10-14T16:26:16Z","endedAt":"2026-10-14T17:34:00Z"}""");

        await RunImportAsync();

        var task = await SingleMeetingTaskAsync();
        var data = JsonDocument.Parse(task.Data!).RootElement;
        var note = await File.ReadAllTextAsync(Path.Combine(host.VaultRoot, "meetings", $"{SourceRef}-transcript.md"));

        Assert.Equal((ItemKind.Meeting, "agent:*", ItemStatus.Open, (int?)null, $"meetings/{SourceRef}-transcript.md"), (task.Kind, task.Assignee, task.Status, task.PbiId, task.VaultPath));
        Assert.StartsWith("MT-", task.Id);
        Assert.StartsWith("Meeting notes: Backlog Refinement (2026-10-14", task.Title);
        Assert.Equal(("audio-capture", SourceRef, 4064, "large-v3-turbo"), (data.GetProperty("createdBy").GetString(), data.GetProperty("sourceRef").GetString(), data.GetProperty("durationSec").GetInt32(), data.GetProperty("model").GetString()));
        Assert.Equal(["Me", "Vlad", "Speaker 2"], data.GetProperty("speakers").EnumerateArray().Select(speaker => speaker.GetString()!));
        Assert.Contains("type: meeting-transcript", note);
        Assert.Contains("[00:00:15] Vlad: Ладно, давайте к вопросам.", note);
        Assert.False(File.Exists(Path.Combine(folder, $"{SourceRef}.json")));
        Assert.StartsWith("Not valid JSON", await File.ReadAllTextAsync(Path.Combine(folder, "failed", "broken.json.reason.txt")));
        Assert.StartsWith("title and transcript are required.", await File.ReadAllTextAsync(Path.Combine(folder, "failed", "no-transcript.json.reason.txt")));

        await File.WriteAllTextAsync(Path.Combine(folder, $"{SourceRef}.json"), MeetingJson());
        await RunImportAsync();

        Assert.Equal(task.Id, (await SingleMeetingTaskAsync()).Id);
        Assert.False(File.Exists(Path.Combine(folder, $"{SourceRef}.json")));
    }

    private async Task RunImportAsync() =>
        await host.Host.Services.TrackActivity().Timeout(Timeout).ExecuteAndWaitAsync(bus => bus.PublishAsync(new ImportMeetings(PowerLoomHost.Vault)).AsTask());

    private async Task<LocalItem> SingleMeetingTaskAsync()
    {
        using var scope = host.Host.Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<PowerLoomDbContext>().LocalItems.AsNoTracking().Where(row => row.Kind == ItemKind.Meeting && row.Vault == PowerLoomHost.Vault).SingleAsync();
    }

    private static string MeetingJson() => $$"""
        {
          "source": "audio-capture",
          "sourceRef": "{{SourceRef}}",
          "title": "Backlog Refinement",
          "startedAt": "2026-10-14T16:26:16+00:00",
          "endedAt": "2026-10-14T17:34:00+00:00",
          "durationSec": 4064,
          "model": "large-v3-turbo",
          "transcriptPath": "D:\\pc\\home\\recordings\\{{SourceRef}}\\transcript.md",
          "transcript": "[00:00:00] Speaker 2: Не, ну, я немножко не про то.\n[00:00:15] Vlad: Ладно, давайте к вопросам.\n[00:00:40] Me: Thank you.",
          "segmentCount": 3,
          "speakers": ["Me", "Vlad", "Speaker 2"]
        }
        """;
}
