using PowerLoom.Contracts;

namespace PowerLoom.Features.Docs.Records;

// One kind of record (or a family): where it goes and how it is written. Returns a line for the log.
public interface IRecordWriter
{
    bool Handles(RecordKind kind);

    Task<string> WriteAsync(RecordKind kind, string vault, string sourceId, CancellationToken cancellation);
}
