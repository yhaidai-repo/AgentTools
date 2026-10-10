using PowerLoom.Contracts;

namespace PowerLoom.Features.Docs.Records.Models;

public sealed record AddRecordRequest(RecordKind Kind, string SourceId);
