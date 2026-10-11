using System.Text;
using PowerLoom.Infrastructure.Attachments;
using PowerLoom.Infrastructure.Attachments.Models;

namespace PowerLoom.Api.Tests.Attachments;

public sealed class AttachmentTextTests
{
    [Fact]
    public void Text_html_and_images_are_accepted_and_the_rest_refused_with_the_reason()
    {
        var markdown = AttachmentText.Extract(new UploadedFile("notes.md", "text/markdown", Encoding.UTF8.GetBytes("# Hi\n")));
        var html = AttachmentText.Extract(new UploadedFile("page.html", "text/html", Encoding.UTF8.GetBytes("<h1>Hi</h1><p>There <b>you</b></p>")));
        var image = AttachmentText.Extract(new UploadedFile("shot.png", "image/png", [1, 2, 3]));
        var empty = AttachmentText.Extract(new UploadedFile("empty.txt", "text/plain", []));
        var unknown = AttachmentText.Extract(new UploadedFile("tool.exe", "application/octet-stream", [1]));
        var binary = AttachmentText.Extract(new UploadedFile("fake.txt", "text/plain", [0xFF, 0xFE, 0xC0]));

        Assert.Equal("# Hi", markdown.Value!.Text);
        Assert.Equal("# Hi\n\nThere **you**", html.Value!.Text!.Replace("\r\n", "\n"));
        Assert.Null(image.Value!.Text);
        Assert.Equal("empty.txt is empty.", empty.Problem!.Detail);
        Assert.StartsWith("tool.exe: unsupported file type.", unknown.Problem!.Detail);
        Assert.StartsWith("fake.txt could not be read:", binary.Problem!.Detail);
    }
}
