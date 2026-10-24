namespace PowerLoom.Api.Tests.Probes;

public static class VaultProbeHandler
{
    // Long enough that two probes of one vault would overlap if the queue let them.
    private static readonly TimeSpan Work = TimeSpan.FromMilliseconds(100);

    public static async Task Handle(VaultProbe probe, ProbeLog log)
    {
        log.Enter(probe);

        await Task.Delay(Work);

        log.Exit();
    }
}
