using PowerLoom.Contracts;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Infrastructure.VaultCapture;
using PowerLoom.Infrastructure.VaultCapture.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;

namespace PowerLoom.Features.Docs.Records;

// The user's "Submit to vault" (their yes, as the vault rules require): the record goes into the project's register
// through VaultCapture and the finding closes with its id. A rejected record leaves the finding open with the reason.
public sealed class FindingRecordWriter(PowerLoomDbContext db, IVaultCapture capture) : IRecordWriter
{
    private const string Actor = "human";

    public bool Handles(RecordKind kind) => kind is RecordKind.OpenQuestion or RecordKind.KnownIssue;

    public async Task<string> WriteAsync(RecordKind kind, string vault, string sourceId, CancellationToken cancellation)
    {
        var finding = await db.LocalItems.FindAsync([sourceId], cancellation);

        if (finding?.Status != ItemStatus.InProgress)
            return $"{sourceId}: not waiting for a submit ({finding?.Status.ToString() ?? "gone"})";

        var data = FindingData.Parse(finding.Data) ?? throw new InvalidOperationException($"{sourceId} has no submit data");
        var added = await capture.AddRegisterRecordAsync(finding.Vault, RecordOf(kind, finding, data), cancellation);

        finding.Resolution = added.Ok ? $"Recorded as {added.Value} in {data.Project}-{RegisterOf(kind)}." : $"Not recorded: {added.Problem.Detail}";

        await ItemStatusChange.SetAsync(db, finding, added.Ok ? ItemStatus.Done : ItemStatus.Open, Actor, null, cancellation);

        return $"{finding.Id}: {finding.Resolution}";
    }

    private static NewRegisterRecord RecordOf(RecordKind kind, LocalItem finding, FindingData data)
    {
        return new NewRegisterRecord(data.Project, kind == RecordKind.OpenQuestion ? "questions" : "issues", finding.Title, finding.Body ?? "", data.Default ?? [], data.Options ?? []);
    }

    private static string RegisterOf(RecordKind kind) => kind == RecordKind.OpenQuestion ? "open-questions" : "known-issues";
}
