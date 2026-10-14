using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Pipeline;

// PowerLoom's import convention: write `<name>.json.tmp`, then rename to `.json` (UTF-8 without BOM).
public static class InboxWriter
{
    // UnsafeRelaxedJsonEscaping keeps Cyrillic readable in the file (the default escapes it as \uXXXX).
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };
    private static readonly UTF8Encoding Utf8NoBom = new(false);

    public static string Write(string inboxPath, MeetingImport import)
    {
        Directory.CreateDirectory(inboxPath);

        var target = Path.Combine(inboxPath, import.SourceRef + ".json");
        var temporary = target + ".tmp";

        File.WriteAllText(temporary, JsonSerializer.Serialize(import, Json), Utf8NoBom);
        File.Move(temporary, target, overwrite: true);

        return target;
    }
}
