using JasperFx.CommandLine;

namespace PowerLoom.Infrastructure.OpenApi;

public sealed class OpenApiWriteInput : NetCoreInput
{
    [Description("The file to write")]
    public string File { get; set; } = "openapi/PowerLoom.Api.json";
}
