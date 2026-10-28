using System.Text.Json;
using PowerLoom.Infrastructure.VaultScan.Models;

namespace PowerLoom.Features.Docs.Records.Models;

// A finding's `data`: what the user chose on Submit (PowerLoom's startFindingSubmit).
public sealed record FindingData(string Type, string Project, string[]? Default, string[]? Options, RecordWorkContext? Context = null)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public static FindingData? Parse(string? data) => data is null ? null : JsonSerializer.Deserialize<FindingData>(data, Json);
}
