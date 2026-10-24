using PowerLoom.Contracts;

namespace PowerLoom.Features.Docs.Records;

// On the vault's queue: one record file write at a time per vault.
public static class AddRecordHandler
{
    public static async Task Handle(AddRecord message, IEnumerable<IRecordWriter> writers, ILogger<AddRecord> logger, CancellationToken cancellation)
    {
        var writer = writers.SingleOrDefault(candidate => candidate.Handles(message.Kind))
            ?? throw new NotSupportedException($"No writer for {message.Kind} records.");
        var outcome = await writer.WriteAsync(message.Kind, message.Vault, message.SourceId, cancellation);

        logger.LogInformation("record {Kind} {SourceId}: {Outcome}", message.Kind, message.SourceId, outcome);
    }
}
