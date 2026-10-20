using System.Diagnostics;
using System.Net.Sockets;
using DevSecrets.DevHub.Models;

namespace DevSecrets.DevHub.Browser;

// One Playwright MCP process (`@playwright/mcp`, pinned in playwright-mcp/package.json) serving one case over
// streamable HTTP on the host. It drives the installed browser and writes recordings into the case's folder.
public sealed class McpProcess : IDisposable
{
    private const string Capabilities = "devtools,vision";
    private static readonly TimeSpan StartTimeout = TimeSpan.FromSeconds(30);

    private readonly Process _process;

    private McpProcess(Process process, int port)
    {
        _process = process;
        Port = port;
    }

    public int Port { get; }

    public bool HasExited => _process.HasExited;

    public static async Task<McpProcess> StartAsync(DevHubOptions options, string outputDir, string secretsFile, bool headless, CancellationToken cancellationToken)
    {
        var start = new ProcessStartInfo(options.NodePath)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            WorkingDirectory = outputDir,
        };

        foreach (var argument in Arguments(options, outputDir, secretsFile, headless))
            start.ArgumentList.Add(argument);

        var process = Process.Start(start) ?? throw new InvalidOperationException("The Playwright MCP process didn't start.");

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        await WaitForPortAsync(process, options.McpPort, cancellationToken);

        return new McpProcess(process, options.McpPort);
    }

    public void Kill()
    {
        if (!_process.HasExited)
            _process.Kill(entireProcessTree: true);
    }

    public void Dispose()
    {
        Kill();
        _process.Dispose();
    }

    private static IEnumerable<string> Arguments(DevHubOptions options, string outputDir, string secretsFile, bool headless)
    {
        yield return Path.Combine(options.McpDir, "node_modules", "@playwright", "mcp", "cli.js");
        yield return "--browser";
        yield return string.IsNullOrWhiteSpace(options.BrowserChannel) ? "chromium" : options.BrowserChannel;
        yield return "--host";
        yield return "127.0.0.1";
        yield return "--port";
        yield return options.McpPort.ToString();
        yield return "--output-dir";
        yield return outputDir;
        yield return "--isolated";
        yield return "--caps";
        yield return Capabilities;
        yield return "--secrets";
        yield return secretsFile;

        if (headless)
            yield return "--headless";
    }

    private static async Task WaitForPortAsync(Process process, int port, CancellationToken cancellationToken)
    {
        using var timeout = new CancellationTokenSource(StartTimeout);
        using var linked = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeout.Token);

        while (!await IsListeningAsync(port))
        {
            if (process.HasExited)
                throw new InvalidOperationException($"The Playwright MCP process exited with {process.ExitCode} before listening.");

            await Task.Delay(250, linked.Token);
        }
    }

    private static async Task<bool> IsListeningAsync(int port)
    {
        try
        {
            using var client = new TcpClient();

            await client.ConnectAsync("127.0.0.1", port);

            return true;
        }
        catch (SocketException)
        {
            return false;
        }
    }
}
