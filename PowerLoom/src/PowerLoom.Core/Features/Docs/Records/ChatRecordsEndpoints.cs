using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Infrastructure.Http;
using PowerLoom.Infrastructure.VaultCapture.Models;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Persistence;
using Wolverine.Http;

namespace PowerLoom.Features.Docs.Records;

// A chat's vault writes (stage 5 of the powerloom-mcp design): a draft, a register record, a record closed.
public static class ChatRecordsEndpoints
{
    public static Task<ProblemDetails> ValidateAsync(string vault, PowerLoomDbContext db, CancellationToken cancellation) => VaultChecks.NotAVaultAsync(vault, db, cancellation);

    [WolverinePost("/api/vaults/{vault}/drafts")]
    public static Task<DraftCaptureResult> CaptureDraft(string vault, CaptureDraftRequest request, ChatRecords records, CancellationToken cancellation) => records.CaptureDraftAsync(vault, request, cancellation);

    [WolverinePost("/api/vaults/{vault}/register-records")]
    public static async Task<Results<Ok<AddedRegisterRecord>, ProblemHttpResult>> AddRegisterRecord(string vault, AddRegisterRecordRequest request, ChatRecords records, CancellationToken cancellation)
    {
        var added = await records.AddRegisterRecordAsync(vault, request, cancellation);

        return added.Ok ? TypedResults.Ok(added.Value) : added.Problem.ToProblemResult();
    }

    [WolverinePost("/api/vaults/{vault}/register-records/close")]
    public static async Task<Results<Ok<ClosedRegisterRecord>, ProblemHttpResult>> CloseRegisterRecord(string vault, CloseRegisterRecordRequest request, ChatRecords records, CancellationToken cancellation)
    {
        var closed = await records.CloseRegisterRecordAsync(vault, request, cancellation);

        return closed.Ok ? TypedResults.Ok(closed.Value) : closed.Problem.ToProblemResult();
    }
}
