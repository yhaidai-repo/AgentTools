using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using PowerLoom.Domain.Pbis;
using PowerLoom.Domain.Tasks;
using PowerLoom.Features.Meetings.Models;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;

namespace PowerLoom.Features.Meetings.Import;

// A recorded meeting becomes a `meeting` task (MT-nnn) for any agent that takes the type (stage 4: the meeting notes
// agent), in the vault the inbox belongs to, with the transcript note as its vault path. The same meeting (its
// transcript note) is never made into a second task.
public sealed class MeetingTaskCreation(PowerLoomDbContext db, VaultFiles files)
{
    private const string Prefix = "MT";
    private const string CreatedBy = "audio-capture";
    private const int TitleMax = 120;

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<MeetingImportOutcome> CreateAsync(string vault, MeetingImport meeting, CancellationToken cancellation)
    {
        var notePath = MeetingTranscriptNote.PathOf(meeting);
        var existing = await db.LocalItems.AsNoTracking().Where(row => row.Kind == ItemKind.Meeting && row.Vault == vault && row.VaultPath == notePath).Select(row => row.Id).FirstOrDefaultAsync(cancellation);

        if (existing is not null)
            return new MeetingImportOutcome(null, $"imported before as {existing}");

        await files.WriteTextAsync(vault, notePath, MeetingTranscriptNote.Render(meeting), cancellation);

        var id = await ItemIds.NextGlobalAsync(db, Prefix, cancellation);

        db.LocalItems.Add(Task(id, vault, meeting, notePath));
        await db.SaveChangesAsync(cancellation);

        return new MeetingImportOutcome(id, $"{id} created");
    }

    private static LocalItem Task(string id, string vault, MeetingImport meeting, string notePath) =>
        new()
        {
            Id = id,
            Kind = ItemKind.Meeting,
            Vault = vault,
            Title = Title(meeting),
            Status = ItemStatus.Open,
            Assignee = AgentStages.AnyAgent,
            Body = Body(meeting),
            Data = JsonSerializer.Serialize(Data(meeting, notePath), Json),
            VaultPath = notePath,
            HeldBy = "[]",
        };

    private static string Title(MeetingImport meeting)
    {
        var title = $"Meeting notes: {meeting.Title} ({meeting.StartedAt.LocalDateTime:yyyy-MM-dd HH:mm})";

        return title.Length <= TitleMax ? title : title[..TitleMax];
    }

    private static string Body(MeetingImport meeting) =>
        $"Recorded {meeting.StartedAt.LocalDateTime:yyyy-MM-dd HH:mm}, {Math.Round(meeting.DurationSec / 60.0)} min, speakers: {string.Join(", ", meeting.Speakers)}. The transcript is the note {MeetingTranscriptNote.PathOf(meeting)}.";

    private static Dictionary<string, object?> Data(MeetingImport meeting, string notePath) =>
        new()
        {
            ["createdBy"] = CreatedBy,
            ["source"] = meeting.Source,
            ["sourceRef"] = meeting.SourceRef,
            ["startedAt"] = meeting.StartedAt,
            ["endedAt"] = meeting.EndedAt,
            ["durationSec"] = meeting.DurationSec,
            ["speakers"] = meeting.Speakers,
            ["transcriptNote"] = notePath,
            ["transcriptPath"] = meeting.TranscriptPath,
            ["model"] = meeting.Model,
            ["segmentCount"] = meeting.SegmentCount,
        };
}
