using System.Diagnostics;
using DevSecrets.StackBridge.Models;
using Microsoft.Extensions.Options;

namespace DevSecrets.StackBridge;

// Runs the DevSecrets PowerShell scripts; they stay the single source of truth for starting and stopping stacks.
public sealed class ScriptRunner(IOptions<StackBridgeOptions> options)
{
    public Process StartScript(string script, IEnumerable<string> arguments, Action<string> onLine, IReadOnlyDictionary<string, string>? environment = null)
    {
        var process = new Process { StartInfo = CreateStartInfo(script, arguments, environment ?? new Dictionary<string, string>()) };

        process.OutputDataReceived += (_, e) => ForwardLine(e.Data, onLine);
        process.ErrorDataReceived += (_, e) => ForwardLine(e.Data, onLine);
        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        return process;
    }

    public async Task<ScriptOutput> RunScriptAsync(string script, IEnumerable<string> arguments, CancellationToken cancellationToken, IReadOnlyDictionary<string, string>? environment = null)
    {
        var lines = new List<string>();
        var gate = new Lock();
        using var process = StartScript(script, arguments, line => AddLine(lines, gate, line), environment);

        // Also waits until both output streams are read to the end.
        await process.WaitForExitAsync(cancellationToken);

        return new ScriptOutput(process.ExitCode, lines);
    }

    private ProcessStartInfo CreateStartInfo(string script, IEnumerable<string> arguments, IReadOnlyDictionary<string, string> environment)
    {
        var startInfo = new ProcessStartInfo("pwsh")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = options.Value.ScriptsDir
        };

        startInfo.ArgumentList.Add("-NoProfile");
        startInfo.ArgumentList.Add("-NonInteractive");
        startInfo.ArgumentList.Add("-File");
        startInfo.ArgumentList.Add(Path.Combine(options.Value.ScriptsDir, script));

        foreach (var argument in arguments)
            startInfo.ArgumentList.Add(argument);

        // Plain text: agents read this output.
        startInfo.Environment["NO_COLOR"] = "1";

        foreach (var variable in environment)
            startInfo.Environment[variable.Key] = variable.Value;

        return startInfo;
    }

    private static void ForwardLine(string? line, Action<string> onLine)
    {
        if (line is not null)
            onLine(line);
    }

    private static void AddLine(List<string> lines, Lock gate, string line)
    {
        lock (gate)
        {
            lines.Add(line);
        }
    }
}
