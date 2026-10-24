namespace PowerLoom.Infrastructure.Mcp;

public static class McpSetup
{
    public static WebApplicationBuilder AddPowerLoomMcp(this WebApplicationBuilder builder)
    {
        builder.Services.AddOptions<McpOptions>().BindConfiguration(McpOptions.Section);

        return builder;
    }
}
