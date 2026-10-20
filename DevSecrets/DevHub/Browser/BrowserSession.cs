using DevSecrets.DevHub.Models;
using Microsoft.Playwright;

namespace DevSecrets.DevHub.Browser;

// One open case: a Chromium context with its page, recording video and a trace into the case's folder.
public sealed class BrowserSession(IBrowserContext context, IPage page, OpenBrowserRequest request, string folder, DateTimeOffset openedAt) : IAsyncDisposable
{
    private const string VideoFile = "video.webm";
    private const string TraceFile = "trace.zip";
    private const int SnapshotMax = 40_000;

    public string Owner => request.Owner;

    public string Case => request.Case;

    public string Folder => folder;

    public IPage Page => page;

    public DateTimeOffset OpenedAt => openedAt;

    public static async Task<BrowserSession> OpenAsync(IBrowser browser, OpenBrowserRequest request, string folder, DateTimeOffset openedAt)
    {
        Directory.CreateDirectory(folder);

        // Local services run with dev certificates the browser doesn't trust.
        var context = await browser.NewContextAsync(new BrowserNewContextOptions { RecordVideoDir = folder, IgnoreHTTPSErrors = true });

        await context.Tracing.StartAsync(new TracingStartOptions { Screenshots = true, Snapshots = true, Title = request.Case });

        var page = await context.NewPageAsync();

        return new BrowserSession(context, page, request, folder, openedAt);
    }

    public async Task<BrowserView> ViewAsync()
    {
        var snapshot = await page.Locator("body").AriaSnapshotAsync();
        var cut = snapshot.Length > SnapshotMax;

        return new BrowserView(page.Url, await page.TitleAsync(), cut ? snapshot[..SnapshotMax] : snapshot, cut);
    }

    // Stopping the trace writes trace.zip; closing the context flushes the video, which Playwright names by a hash.
    public async Task<BrowserClosed> CloseAsync()
    {
        await context.Tracing.StopAsync(new TracingStopOptions { Path = Path.Combine(folder, TraceFile) });

        var video = page.Video;

        await context.CloseAsync();
        await RenameVideoAsync(video);

        return new BrowserClosed(request.Case, Directory.GetFiles(folder).Select(path => path.Replace('\\', '/')).Order(StringComparer.Ordinal).ToArray());
    }

    public ValueTask DisposeAsync() => new(context.CloseAsync());

    private async Task RenameVideoAsync(IVideo? video)
    {
        if (video is null)
            return;

        var recorded = await video.PathAsync();
        var target = Path.Combine(folder, VideoFile);

        if (File.Exists(recorded) && recorded != target)
            File.Move(recorded, target, overwrite: true);
    }
}
