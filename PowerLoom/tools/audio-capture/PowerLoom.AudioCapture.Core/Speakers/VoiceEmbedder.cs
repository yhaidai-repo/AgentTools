using PowerLoom.AudioCapture.Recording;
using SherpaOnnx;

namespace PowerLoom.AudioCapture.Speakers;

// A voice print (embedding vector) of a stretch of 16 kHz mono speech; voices compare by cosine similarity.
public sealed class VoiceEmbedder : IDisposable
{
    private readonly SpeakerEmbeddingExtractor _extractor;
    private readonly Lock _sync = new();

    public VoiceEmbedder(string embeddingModel)
    {
        _extractor = new SpeakerEmbeddingExtractor(new SpeakerEmbeddingExtractorConfig { Model = embeddingModel, NumThreads = 2, Provider = "cpu" });
    }

    public float[]? Embed(float[] samples)
    {
        lock (_sync)
        {
            using var stream = _extractor.CreateStream();

            stream.AcceptWaveform(MonoResampler.WhisperRate, samples);
            stream.InputFinished();

            return _extractor.IsReady(stream) ? _extractor.Compute(stream) : null;
        }
    }

    public static double Similarity(float[] a, float[] b)
    {
        double dot = 0, normA = 0, normB = 0;

        for (var i = 0; i < a.Length; i++)
        {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        return normA == 0 || normB == 0 ? 0 : dot / Math.Sqrt(normA * normB);
    }

    public void Dispose() => _extractor.Dispose();
}
