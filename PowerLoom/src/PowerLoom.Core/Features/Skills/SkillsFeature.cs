using PowerLoom.Infrastructure.Skills;

namespace PowerLoom.Features.Skills;

public static class SkillsFeature
{
    public static IServiceCollection AddSkillsFeature(this IServiceCollection services)
    {
        services.AddOptions<SkillsOptions>().BindConfiguration(SkillsOptions.Section);
        services.AddSingleton<SkillFiles>();
        services.AddScoped<SkillEditing>();

        return services;
    }
}
