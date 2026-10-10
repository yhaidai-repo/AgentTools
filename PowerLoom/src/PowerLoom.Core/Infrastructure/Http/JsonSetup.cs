using System.Text.Json;
using System.Text.Json.Serialization;

namespace PowerLoom.Infrastructure.Http;

public static class JsonSetup
{
    // Enums travel as their kebab-case names ("open-question"), the way adoa's TypeScript and the vault notes spell them.
    // Numbers are numbers: the OpenAPI document then types them as integers, not integer-or-string.
    public static WebApplicationBuilder AddPowerLoomJson(this WebApplicationBuilder builder)
    {
        builder.Services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.KebabCaseLower));
            options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
        });

        return builder;
    }
}
