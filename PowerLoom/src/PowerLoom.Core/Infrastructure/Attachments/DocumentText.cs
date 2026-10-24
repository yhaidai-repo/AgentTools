using System.Globalization;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Wordprocessing;
using UglyToad.PdfPig;
using WordTable = DocumentFormat.OpenXml.Wordprocessing.Table;

namespace PowerLoom.Infrastructure.Attachments;

// Office documents as agents read them: PDF pages as text, Word as paragraphs (headings as `#` lines, table rows as
// `|` cells), Excel as a "## <sheet>" section of CSV rows per non-empty sheet.
public static class DocumentText
{
    public static string Pdf(byte[] bytes)
    {
        using var document = PdfDocument.Open(bytes);

        return string.Join("\n\n", document.GetPages().Select(page => page.Text));
    }

    public static string Docx(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes);
        using var document = WordprocessingDocument.Open(stream, false);
        var body = document.MainDocumentPart?.Document?.Body;

        return body is null ? "" : string.Join("\n\n", body.ChildElements.Select(BlockText).Where(text => text.Length > 0));
    }

    public static string Xlsx(byte[] bytes)
    {
        using var stream = new MemoryStream(bytes);
        using var document = SpreadsheetDocument.Open(stream, false);
        var workbook = document.WorkbookPart ?? throw new InvalidDataException("no workbook");
        var shared = workbook.SharedStringTablePart?.SharedStringTable?.Elements<SharedStringItem>().Select(item => item.InnerText).ToList() ?? [];
        var sheets = workbook.Workbook?.Sheets?.Elements<Sheet>() ?? [];

        return string.Join("\n\n", sheets.Select(sheet => SheetText(workbook, sheet, shared)).Where(text => text is not null));
    }

    private static string BlockText(OpenXmlElement element)
    {
        return element switch
        {
            Paragraph paragraph => ParagraphText(paragraph),
            WordTable table => string.Join("\n", table.Elements<TableRow>().Select(row => string.Join(" | ", row.Elements<TableCell>().Select(cell => cell.InnerText.Trim())))),
            _ => "",
        };
    }

    private static string ParagraphText(Paragraph paragraph)
    {
        var text = paragraph.InnerText.Trim();
        var style = paragraph.ParagraphProperties?.ParagraphStyleId?.Val?.Value ?? "";
        var level = style.StartsWith("Heading", StringComparison.OrdinalIgnoreCase) && int.TryParse(style["Heading".Length..], out var number) ? number : 0;

        return level is >= 1 and <= 6 && text.Length > 0 ? $"{new string('#', level)} {text}" : text;
    }

    private static string? SheetText(WorkbookPart workbook, Sheet sheet, List<string> shared)
    {
        if (sheet.Id?.Value is null || workbook.GetPartById(sheet.Id.Value) is not WorksheetPart part)
            return null;

        var rows = (part.Worksheet?.Descendants<Row>() ?? []).Select(row => string.Join(",", row.Elements<Cell>().Select(cell => CsvCell(CellText(cell, shared))))).ToList();

        return rows.Count == 0 ? null : string.Join("\n", rows.Prepend($"## {sheet.Name?.Value}"));
    }

    private static string CellText(Cell cell, List<string> shared)
    {
        var value = cell.CellValue?.InnerText ?? "";

        if (cell.DataType?.Value == CellValues.SharedString && int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var index) && index < shared.Count)
            return shared[index];

        return cell.DataType?.Value == CellValues.InlineString ? cell.InnerText : value;
    }

    private static string CsvCell(string text) => text.IndexOfAny(['"', ',', '\r', '\n']) >= 0 ? $"\"{text.Replace("\"", "\"\"")}\"" : text;
}
