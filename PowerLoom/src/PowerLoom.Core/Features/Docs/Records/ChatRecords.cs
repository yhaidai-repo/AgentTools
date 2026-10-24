using PowerLoom.Contracts;
using PowerLoom.Features.Docs.Records.Models;
using PowerLoom.Infrastructure.VaultCapture;
using PowerLoom.Infrastructure.VaultCapture.Models;
using PowerLoom.Infrastructure.Vaults;
using PowerLoom.Infrastructure.VaultScan;
using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Features.Docs.Records;

// The capture tools for chats without file access (stage 5 of the powerloom-mcp design, open decision MCPQ-008: the
// vault read tools plus these, no raw note writes). An agent stages the same writes for the end of its run; a chat has
// no run and the user has already said yes, so each one is written at once, in the format the agents' are.
public sealed class ChatRecords(IVaultCapture capture, VaultFiles files, TimeProvider clock)
{
    private static readonly string[] RegisterKinds = [MaintenanceRecords.Questions, MaintenanceRecords.Issues];
    private static readonly string[] ClosingStatuses = ["fixed", "resolved", "duplicate"];

    // A rejected draft is an answer (the module's errors, to fix and send again), not a failure.
    public Task<DraftCaptureResult> CaptureDraftAsync(string vault, CaptureDraftRequest request, CancellationToken cancellation)
    {
        var draft = new DraftCapture(request.Project, request.Name, request.Title, request.Source, request.Target, request.Captured, request.Assumptions ?? [], request.ToFill ?? []);

        return capture.CaptureDraftAsync(vault, draft, cancellation);
    }

    public async Task<Outcome<AddedRegisterRecord>> AddRegisterRecordAsync(string vault, AddRegisterRecordRequest request, CancellationToken cancellation)
    {
        if (!RegisterKinds.Contains(request.Kind))
            return Outcome<AddedRegisterRecord>.Failure(Problem.Invalid("kind is questions (open questions) or issues (known issues)."));

        var record = new NewRegisterRecord(request.Project, request.Kind, request.Title, request.Text, request.Default ?? [], request.Options ?? []);
        var added = await capture.AddRegisterRecordAsync(vault, record, cancellation);

        return added.Ok ? Outcome<AddedRegisterRecord>.Success(new AddedRegisterRecord(added.Value)) : Outcome<AddedRegisterRecord>.Failure(added.Problem);
    }

    // Only the register note changes; heading links elsewhere that name the record are left for the vault review, which
    // points them at the register as the vault rules say. Read and written back under the register's lock, which
    // VaultCapture's adds take too.
    public async Task<Outcome<ClosedRegisterRecord>> CloseRegisterRecordAsync(string vault, CloseRegisterRecordRequest request, CancellationToken cancellation)
    {
        var paths = PathProblem(request.Path) ?? (request.DuplicateOf is { } original ? PathProblem(original.Path) : null);

        if (paths is not null)
            return Outcome<ClosedRegisterRecord>.Failure(paths);

        if (MaintenanceRecords.RegisterKindOf(request.Path) is null || !files.Exists(vault, request.Path))
            return NotOpen(request);

        using var held = await files.LockAsync(vault, request.Path, cancellation);

        if (held is null)
            return Outcome<ClosedRegisterRecord>.Failure(Problem.Conflict($"{request.Path} is being written by another process: try again in a moment."));

        return await CloseHeldAsync(vault, request, cancellation);
    }

    private async Task<Outcome<ClosedRegisterRecord>> CloseHeldAsync(string vault, CloseRegisterRecordRequest request, CancellationToken cancellation)
    {
        var text = await files.ReadTextAsync(vault, request.Path, cancellation);
        var record = text is null ? null : MaintenanceRecords.Of(request.Path, text).FirstOrDefault(candidate => candidate.Id == request.Id && candidate.IsOpen);

        if (record is null)
            return NotOpen(request);

        var problem = StatusProblem(record, request) ?? await DuplicateProblemAsync(vault, request, cancellation);

        if (problem is not null)
            return Outcome<ClosedRegisterRecord>.Failure(Problem.Invalid(problem));

        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);

        await files.WriteTextAsync(vault, request.Path, RegisterRecordClosing.Close(text!, record, ClosingOf(request, today), today), cancellation);

        return Outcome<ClosedRegisterRecord>.Success(new ClosedRegisterRecord(request.Path, request.Id, request.Status));
    }

    private static Outcome<ClosedRegisterRecord> NotOpen(CloseRegisterRecordRequest request) =>
        Outcome<ClosedRegisterRecord>.Failure(Problem.NotFound($"{request.Path} has no open record {request.Id} (vault_registers lists them)."));

    private static Problem? PathProblem(string path)
    {
        var parsed = VaultPath.Parse(path);

        return parsed.Ok ? null : parsed.Problem;
    }

    private static string? StatusProblem(MaintenanceRecord record, CloseRegisterRecordRequest request)
    {
        if (!ClosingStatuses.Contains(request.Status))
            return "status is fixed, resolved or duplicate.";

        if (request.Status == "fixed" && record.Kind != MaintenanceRecords.Issues)
            return "only a known issue (KI) is fixed; use resolved.";

        if (request.Status != "duplicate")
            return request.DuplicateOf is null ? null : "duplicateOf goes with status duplicate only.";

        return request.DuplicateOf is null ? "a duplicate needs duplicateOf: the register path and id of the record it repeats." : null;
    }

    private async Task<string?> DuplicateProblemAsync(string vault, CloseRegisterRecordRequest request, CancellationToken cancellation)
    {
        if (request.DuplicateOf is not { } original)
            return null;

        if (original.Path == request.Path && original.Id == request.Id)
            return "a record can't duplicate itself.";

        var text = MaintenanceRecords.RegisterKindOf(original.Path) is null ? null : await files.ReadTextAsync(vault, original.Path, cancellation);
        var exists = text is not null && MaintenanceRecords.Of(original.Path, text).Any(candidate => candidate.Id == original.Id);

        return exists ? null : $"no record {original.Id} in {original.Path}.";
    }

    private static RecordClosingEdit ClosingOf(CloseRegisterRecordRequest request, DateOnly today)
    {
        var decision = OneLine($"{DuplicateNote(request)}{request.Decision}");

        return new RecordClosingEdit(request.Status == "fixed" ? "Fixed" : "Resolved", $"{OneLine(request.DecidedBy)}, {today:yyyy-MM-dd}", decision);
    }

    // "Duplicate of KI-001. ", with the register when it is another one.
    private static string DuplicateNote(CloseRegisterRecordRequest request)
    {
        if (request.DuplicateOf is not { } original)
            return "";

        var elsewhere = original.Path == request.Path ? "" : $" ({original.Path})";

        return $"Duplicate of {original.Id}{elsewhere}. ";
    }

    // The decision block is one line: a line break could start a heading (a record) of its own.
    private static string OneLine(string text) => string.Join(" ", text.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
}
