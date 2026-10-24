using Alba;
using PowerLoom.Infrastructure.Health;

namespace PowerLoom.Api.Tests.Health;

[Collection(PowerLoomCollection.Name)]
public sealed class HealthEndpointTests(PowerLoomHost host)
{
    [Fact]
    public async Task The_database_and_the_ticker_are_healthy_after_start()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Get.Url(HealthSetup.Path);
            scenario.StatusCodeShouldBeOk();
            scenario.ContentShouldBe("Healthy");
        });
    }

    // No runner in the tests: degraded, never unhealthy (PowerLoom runs without it).
    [Fact]
    public async Task The_runner_check_is_degraded_while_the_runner_does_not_answer()
    {
        await host.Host.Scenario(scenario =>
        {
            scenario.Get.Url(HealthSetup.RunnerPath);
            scenario.StatusCodeShouldBeOk();
            scenario.ContentShouldBe("Degraded");
        });
    }
}
