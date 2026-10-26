using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Contracts;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using PowerLoom.Persistence.Entities;
using Wolverine;
using Wolverine.Http;

namespace PowerLoom.Features.Docs.Records;

// A What-went-wrong record from a chat or the web (www_create): stored here, then appended to the vault's www-log.md like
// the Finish dialog's (user decision 2026-10-26: PowerLoom's own tables are written through its API only).
public static class WwwRecordsEndpoints
{
    private static readonly string[] Kinds = ["complaint", "notice"];
    private static readonly string[] Faults = ["Human", "Agent"];

    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverinePost("/api/vaults/{vault}/www-records")]
    public static async Task<Results<Ok<CreatedWwwRecord>, ProblemHttpResult>> Post(string vault, CreateWwwRecordRequest request, PowerLoomDbContext db, IMessageBus bus, CancellationToken cancellation)
    {
        if (!Kinds.Contains(request.Kind) || !Faults.Contains(request.Fault))
            return Problem.Invalid($"Kind is one of {string.Join(", ", Kinds)} and fault one of {string.Join(", ", Faults)}.").ToProblemResult();

        var record = new WwwRecord
        {
            Vault = vault,
            Title = request.Title.Trim(),
            Kind = request.Kind,
            Project = request.Project.Trim(),
            Planned = request.Planned,
            Happened = request.Happened,
            Fault = request.Fault,
            RootCause = request.RootCause,
            Resolution = request.Resolution,
            PreventiveAction = request.PreventiveAction,
            Assumptions = request.Assumptions,
            Source = request.Source,
        };

        db.WwwRecords.Add(record);
        await db.SaveChangesAsync(cancellation);
        await bus.PublishAsync(new AddRecord(vault, RecordKind.Www, record.Id.ToString()));

        return TypedResults.Ok(new CreatedWwwRecord(record.Id));
    }
}
