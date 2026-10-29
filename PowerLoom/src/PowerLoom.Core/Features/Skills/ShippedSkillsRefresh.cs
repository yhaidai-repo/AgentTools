namespace PowerLoom.Features.Skills;

// Runs the shipped-skills refresh once per start, after the migrations (persistence registers its migrator first). A
// failed refresh is logged and the API starts anyway: the skills keep the text they had.
public sealed class ShippedSkillsRefresh(IServiceScopeFactory scopes, ILogger<ShippedSkillsRefresh> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = scopes.CreateScope();

        try
        {
            await scope.ServiceProvider.GetRequiredService<ShippedSkillsRefresher>().RefreshAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            logger.LogError(exception, "skills: the shipped skills could not be written; they keep their current text");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
