using System.Collections.Concurrent;

namespace PowerLoom.Api.Tests.Probes;

public sealed class ProbeLog
{
    private int _running;

    public ConcurrentBag<VaultProbe> Handled { get; } = [];

    public int MaxConcurrent { get; private set; }

    public void Enter(VaultProbe probe)
    {
        var running = Interlocked.Increment(ref _running);

        MaxConcurrent = Math.Max(MaxConcurrent, running);
        Handled.Add(probe);
    }

    public void Exit() => Interlocked.Decrement(ref _running);
}
