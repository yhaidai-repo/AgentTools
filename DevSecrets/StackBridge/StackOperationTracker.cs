using System.Diagnostics;
using DevSecrets.StackBridge.Models;

namespace DevSecrets.StackBridge;

// The one stack operation the bridge runs at a time, and the tail of its output.
public sealed class StackOperationTracker
{
    private const int MaxOutputLines = 200;

    private readonly Lock _gate = new();
    private readonly Queue<string> _output = new();
    private StackOperation _operation = StackOperation.Idle;
    private Process? _startProcess;

    public StackOperation Current
    {
        get
        {
            lock (_gate)
            {
                return _operation;
            }
        }
    }

    public IReadOnlyList<string> Output
    {
        get
        {
            lock (_gate)
            {
                return _output.ToArray();
            }
        }
    }

    public bool TryBegin(StartStackRequest request, DateTimeOffset startedAt, DateTimeOffset expiresAt)
    {
        lock (_gate)
        {
            if (IsBusy())
                return false;

            _output.Clear();
            _operation = new StackOperation(StackPhase.Starting, request.Services, request.Branch, startedAt, expiresAt, null);

            return true;
        }
    }

    public void AttachStartProcess(Process process)
    {
        lock (_gate)
        {
            _startProcess = process;
        }
    }

    public void AppendOutput(string line)
    {
        lock (_gate)
        {
            _output.Enqueue(line);
            TrimOutput();
        }
    }

    public void CompleteStart(int exitCode)
    {
        lock (_gate)
        {
            _startProcess = null;

            // A stop that began meanwhile owns the phase now.
            if (_operation.Phase != StackPhase.Starting)
                return;

            var phase = exitCode == 0 ? StackPhase.Ready : StackPhase.Failed;
            _operation = _operation with { Phase = phase, ExitCode = exitCode };
        }
    }

    // Returns the start script still running, if any, so the caller can kill it.
    public Process? BeginStop()
    {
        lock (_gate)
        {
            var startProcess = _startProcess;
            _startProcess = null;
            _operation = _operation with { Phase = StackPhase.Stopping };

            return startProcess;
        }
    }

    public void Reset()
    {
        lock (_gate)
        {
            _operation = StackOperation.Idle;
        }
    }

    public bool IsExpired(DateTimeOffset now)
    {
        lock (_gate)
        {
            return _operation.Phase is StackPhase.Starting or StackPhase.Ready or StackPhase.Failed
                && _operation.ExpiresAt <= now;
        }
    }

    public bool HasOperation()
    {
        lock (_gate)
        {
            return _operation.Phase != StackPhase.Idle;
        }
    }

    private bool IsBusy() => _operation.Phase is StackPhase.Starting or StackPhase.Stopping;

    private void TrimOutput()
    {
        while (_output.Count > MaxOutputLines)
            _output.Dequeue();
    }
}
