using System.Text;
using PowerLoom.Infrastructure.Attachments;
using PowerLoom.Infrastructure.Attachments.Models;

namespace PowerLoom.Api.Tests.Attachments;

public sealed class AttachmentTextTests
{
    [Fact]
    public void Text_html_images_and_plain_text_of_any_type_are_accepted_and_the_rest_refused_with_the_reason()
    {
        var markdown = AttachmentText.Extract(new UploadedFile("notes.md", "text/markdown", Encoding.UTF8.GetBytes("# Hi\n")));
        var html = AttachmentText.Extract(new UploadedFile("page.html", "text/html", Encoding.UTF8.GetBytes("<h1>Hi</h1><p>There <b>you</b></p>")));
        var image = AttachmentText.Extract(new UploadedFile("shot.png", "image/png", [1, 2, 3]));
        var empty = AttachmentText.Extract(new UploadedFile("empty.txt", "text/plain", []));
        var unknown = AttachmentText.Extract(new UploadedFile("tool.exe", "application/octet-stream", [1]));
        var binary = AttachmentText.Extract(new UploadedFile("fake.txt", "text/plain", [0xFF, 0xFE, 0xC0]));
        var x12 = AttachmentText.Extract(new UploadedFile("41856275 Commercial (1).271", "application/octet-stream", Encoding.UTF8.GetBytes("ISA*00*~\r\nLS*2120~NM1*TTP*2*ACMEDISTRIBUTION~")));
        var binaryOfOtherType = AttachmentText.Extract(new UploadedFile("data.bin", "application/octet-stream", [0x50, 0x4B, 0x03, 0x04]));

        Assert.Equal("# Hi", markdown.Value!.Text);
        Assert.Equal("# Hi\n\nThere **you**", html.Value!.Text!.Replace("\r\n", "\n"));
        Assert.Null(image.Value!.Text);
        Assert.Equal("empty.txt is empty.", empty.Problem!.Detail);
        Assert.StartsWith("tool.exe: unsupported file type.", unknown.Problem!.Detail);
        Assert.StartsWith("fake.txt could not be read:", binary.Problem!.Detail);
        Assert.Equal("ISA*00*~\r\nLS*2120~NM1*TTP*2*ACMEDISTRIBUTION~", x12.Value!.Text);
        Assert.StartsWith("data.bin: unsupported file type.", binaryOfOtherType.Problem!.Detail);
    }
}
