using System.Text.Json;
using PowerLoom.AdoIntegration.Features.SyncPbis;
using PowerLoom.AdoIntegration.Settings;
using PowerLoom.Features.ImportSources;

namespace PowerLoom.Api.Tests.ImportSources;

public sealed class ImportRequestTests
{
    private static readonly AdoSettings Ado = new() { OrgUrl = "https://dev.azure.com/contoso", Project = "ZZ" };

    [Fact]
    public void Only_work_item_links_of_the_project_count_and_safe_links_are_unwrapped()
    {
        const string html = """<a href="https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fdev.azure.com%2Fcontoso%2FZZ%2F_workitems%2Fedit%2F30001&amp;data=x">PBI</a> and https://dev.azure.com/other/ZZ/_workitems/edit/30002 and [587484]""";
        const string text = "See https://contoso.visualstudio.com/ZZ/_workitems/edit/30003. Again https://dev.azure.com/contoso/ZZ/_workitems/edit/30001";

        Assert.Equal([30001, 30003], PbiLinks.Extract(Ado, html, text));
        Assert.Equal(30004, PbiLinks.ParseReference("https://dev.azure.com/contoso/ZZ/_workitems/edit/30004?x=1"));
        Assert.Equal(7, PbiLinks.ParseReference("#7"));
        Assert.Null(PbiLinks.ParseReference("seven"));
    }

    [Fact]
    public void A_request_is_checked_field_by_field()
    {
        var ok = ImportRequestParser.Parse(Element("""{"source":"outlook","adoIds":[1,2],"prepare":false}"""), "mail-1.json");
        var noRef = ImportRequestParser.Parse(Element("""{"adoIds":[1]}"""), null);
        var badIds = ImportRequestParser.Parse(Element("""{"source":"s","sourceRef":"r","adoIds":[0]}"""), null);
        var empty = ImportRequestParser.Parse(Element("""{"source":"s","sourceRef":"r"}"""), null);

        Assert.Equal(("outlook", "mail-1.json", false), (ok.Value!.Source, ok.Value.SourceRef, ok.Value.Prepare));
        Assert.Equal("source and sourceRef are required.", noRef.Problem!.Detail);
        Assert.Equal("adoIds must be whole numbers above 0.", badIds.Problem!.Detail);
        Assert.Equal("Give adoIds, html or text.", empty.Problem!.Detail);
    }

    private static JsonElement Element(string json) => JsonDocument.Parse(json).RootElement.Clone();
}
