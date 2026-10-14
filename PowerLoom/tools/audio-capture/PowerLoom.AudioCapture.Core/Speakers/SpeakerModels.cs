using PowerLoom.AudioCapture.Transcription;
using SharpCompress.Readers;

namespace PowerLoom.AudioCapture.Speakers;

// The two ONNX models of speaker detection (sherpa-onnx releases on GitHub, free, offline): pyannote segmentation 3.0
// (who speaks when, 7 MB, shipped as tar.bz2) and WeSpeaker ResNet34 VoxCeleb (voice embeddings, 26 MB).
public static class SpeakerModels
{
    private const string SegmentationUrl = "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-segmentation-models/sherpa-onnx-pyannote-segmentation-3-0.tar.bz2";
    private const string EmbeddingUrl = "https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/wespeaker_en_voxceleb_resnet34_LM.onnx";

    public static string SegmentationPath => Path.Combine(ModelStore.Root, "pyannote-segmentation-3.0.onnx");

    public static string EmbeddingPath => Path.Combine(ModelStore.Root, "wespeaker_en_voxceleb_resnet34_LM.onnx");

    public static async Task EnsureAsync(Action<string> log)
    {
        Directory.CreateDirectory(ModelStore.Root);

        if (!File.Exists(SegmentationPath))
            await DownloadSegmentationAsync(log);

        if (!File.Exists(EmbeddingPath))
            await DownloadAsync(EmbeddingUrl, EmbeddingPath, log);
    }

    private static async Task DownloadSegmentationAsync(Action<string> log)
    {
        var archive = SegmentationPath + ".tar.bz2";

        await DownloadAsync(SegmentationUrl, archive, log);
        ExtractModel(archive, SegmentationPath);
        File.Delete(archive);
    }

    private static async Task DownloadAsync(string url, string path, Action<string> log)
    {
        log($"Downloading {Path.GetFileName(path)} …");

        using var http = new HttpClient();
        await using var source = await http.GetStreamAsync(url);
        await using var target = File.Create(path + ".part");

        await source.CopyToAsync(target);
        target.Close();
        File.Move(path + ".part", path, overwrite: true);
        log($"Downloaded {new FileInfo(path).Length / 1_000_000} MB");
    }

    // The archive holds one folder with model.onnx (plus test files); only the model is kept.
    private static void ExtractModel(string archive, string modelPath)
    {
        using var stream = File.OpenRead(archive);
        using var reader = ReaderFactory.Open(stream);

        while (reader.MoveToNextEntry())
        {
            if (reader.Entry.Key?.EndsWith("model.onnx", StringComparison.OrdinalIgnoreCase) == true)
                CopyEntry(reader, modelPath);
        }

        if (!File.Exists(modelPath))
            throw new InvalidOperationException($"No model.onnx in {archive}");
    }

    private static void CopyEntry(IReader reader, string path)
    {
        using var entry = reader.OpenEntryStream();
        using var target = File.Create(path);

        entry.CopyTo(target);
    }
}
