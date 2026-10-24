using JasperFx.CommandLine;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace PowerLoom.Infrastructure.OpenApi;

// `dotnet run -- openapi-write <file>`: the document of every endpoint from a host that is built but not started (no
// database); the committed file is what the web generates its typed client from.
[Description("Writes the OpenAPI document to a file", Name = "openapi-write")]
public sealed class OpenApiWriteCommand : JasperFxAsyncCommand<OpenApiWriteInput>
{
    private const string DocumentName = "v1";

    public override async Task<bool> Execute(OpenApiWriteInput input)
    {
        using var host = input.BuildHost();
        var provider = host.Services.GetKeyedService<IOpenApiDocumentProvider>(DocumentName) ?? host.Services.GetRequiredService<IOpenApiDocumentProvider>();
        var document = await provider.GetOpenApiDocumentAsync(CancellationToken.None);

        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(input.File))!);

        await using var stream = File.Create(input.File);
        await document.SerializeAsJsonAsync(stream, OpenApiSpecVersion.OpenApi3_1, CancellationToken.None);

        Console.WriteLine($"Wrote {input.File}");

        return true;
    }
}
