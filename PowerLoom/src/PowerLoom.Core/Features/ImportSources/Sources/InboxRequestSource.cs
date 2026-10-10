using System.Text.Json;
using Microsoft.Extensions.Options;
using PowerLoom.Contracts;
using PowerLoom.Contracts.Imports;
using PowerLoom.Persistence;

namespace PowerLoom.Features.ImportSources.Sources;

// Any tool's PbiImportRequest as a JSON file at the import inbox root; a file without a sourceRef uses its file name.
public sealed class InboxRequestSource(PowerLoomDbContext db, IOptions<ImportOptions> options) : FolderImportSource(db, options)
{
    public override string Id => "inbox";

    protected override string SubFolder => "";

    protected override Outcome<PbiImportRequest> ToRequest(JsonElement content, string file) => ImportRequestParser.Parse(content, file);
}
