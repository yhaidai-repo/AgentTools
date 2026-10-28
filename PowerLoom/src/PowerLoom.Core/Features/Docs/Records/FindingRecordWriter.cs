using PowerLoom.Contracts;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Features.Tasks;
using PowerLoom.Infrastructure.VaultCapture;
using PowerLoom.Infrastructure.VaultCapture.Models;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using PowerLoom.Persistence.Enums;
using PowerLoom.Persistence.Items;
using Wolverine;
using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Features.Docs.Records;

// The user's "Submit to vault" (their yes, as the vault rules require): the record goes into the project's register
// through VaultCapture and the finding closes with its id. A rejected record leaves the finding open with the reason.
public sealed class FindingRecordWriter(PowerLoomDbContext db, IVaultCapture capture, IMessageBus bus) : IRecordWriter
{
    private const string Actor = "human";

    public bool Handles(RecordKind kind) => kind is RecordKind.OpenQuestion or RecordKind.KnownIssue;

    public async Task<string> WriteAsync(RecordKind kind, string vault, string sourceId, CancellationToken cancellation)
    {
        var finding = await db.LocalItems.FindAsync([sourceId], cancellation);

        if (finding?.Status != ItemStatus.InProgress)
            return $"{sourceId}: not waiting for a submit ({finding?.Status.ToString() ?? "gone"})";

        var data = FindingData.Parse(finding.Data) ?? throw new InvalidOperationException($"{sourceId} has no submit data");
        var contextProblem = await RecordContextValidation.ProblemAsync(data.Context, finding.Vault, db, cancellation);
        var added = contextProblem is null
            ? await capture.AddRegisterRecordAsync(finding.Vault, RecordOf(kind, finding, data), cancellation)
            : Outcome<string>.Failure(Problem.Invalid(contextProblem));

        finding.Resolution = added.Ok ? $"Recorded as {added.Value} in {data.Project}-{RegisterOf(kind)}." : $"Not recorded: {added.Problem.Detail}";

        await ItemStatusChange.SetAsync(db, finding, added.Ok ? ItemStatus.Done : ItemStatus.Open, Actor, null, cancellation);
        // The PBI page and notes show the finding's outcome (the web's dispatch tick did this render until phase 5).
        await PbiChanges.PublishAsync(db, bus, finding.PbiId, Actor, cancellation);

        return $"{finding.Id}: {finding.Resolution}";
    }

    private static NewRegisterRecord RecordOf(RecordKind kind, LocalItem finding, FindingData data)
    {
        var context = new RecordWorkContext(finding.PbiId ?? data.Context?.PbiId, finding.ParentId ?? data.Context?.TaskId, data.Context?.ChatId, data.Context?.SessionId);
        return new NewRegisterRecord(data.Project, kind == RecordKind.OpenQuestion ? "questions" : "issues", finding.Title, finding.Body ?? "", data.Default ?? [], data.Options ?? [], context);
    }

    private static string RegisterOf(RecordKind kind) => kind == RecordKind.OpenQuestion ? "open-questions" : "known-issues";
}
