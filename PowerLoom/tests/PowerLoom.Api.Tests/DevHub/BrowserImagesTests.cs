using DevSecrets.DevHub.Browser;
namespace PowerLoom.Api.Tests.DevHub;

public sealed class BrowserImagesTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "guide-image-tests-" + Guid.NewGuid().ToString("N"));
    private const string Owner = "powerloom-run-1";
    private const string Case = "guide-demo";
    private static readonly byte[] Png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=");

    public BrowserImagesTests() => Directory.CreateDirectory(Path.Combine(_root, Owner, Case));

    [Fact]
    public void Read_AnOwnedPng_ReturnsOnlyItsBytes()
    {
        File.WriteAllBytes(Path.Combine(_root, Owner, Case, "form.png"), Png);
        var result = BrowserImages.Read(_root, Owner, Case, "form.png");
        Assert.True(result.IsSuccess);
        Assert.Equal(Png, Convert.FromBase64String(result.Value!.Base64));
    }

    [Theory]
    [InlineData("../other", Case, "form.png")]
    [InlineData(Owner, "../other", "form.png")]
    [InlineData(Owner, Case, "../form.png")]
    [InlineData(Owner, Case, "trace.zip")]
    [InlineData(Owner, Case, "D:/secret.png")]
    public void Read_TraversalOrNonImage_IsRefused(string owner, string caseName, string file)
    {
        Assert.Equal(400, BrowserImages.Read(_root, owner, caseName, file).StatusCode);
    }

    [Fact]
    public void Read_AnotherOwnerCannotAliasTheImage()
    {
        File.WriteAllBytes(Path.Combine(_root, Owner, Case, "form.png"), Png);
        Assert.Equal(404, BrowserImages.Read(_root, "powerloom-run-2", Case, "form.png").StatusCode);
    }

    [Fact]
    public void Read_FakeOrOversizedPng_IsRefused()
    {
        var path = Path.Combine(_root, Owner, Case, "form.png");
        File.WriteAllText(path, "not an image");
        Assert.Equal(400, BrowserImages.Read(_root, Owner, Case, "form.png").StatusCode);
        File.WriteAllBytes(path, new byte[2 * 1024 * 1024 + 1]);
        Assert.Equal(400, BrowserImages.Read(_root, Owner, Case, "form.png").StatusCode);
    }

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }
}
