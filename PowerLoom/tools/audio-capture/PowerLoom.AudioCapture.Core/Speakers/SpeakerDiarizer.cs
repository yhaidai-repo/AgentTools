using PowerLoom.AudioCapture.Models;
using SherpaOnnx;

namespace PowerLoom.AudioCapture.Speakers;

// Who speaks when on the system channel: pyannote segmentation + speaker embeddings + clustering (sherpa-onnx, CPU).
// The number of voices is not known up front; the clustering threshold decides how different two voices must be.
public sealed class SpeakerDiarizer : IDisposable
{
    private const float ClusteringThreshold = 0.5f;
    // CPU only in this runtime build; a one-hour meeting takes a few minutes in the background after Stop.
    private static readonly int Threads = Math.Max(2, Environment.ProcessorCount / 2);
    private readonly OfflineSpeakerDiarization _diarization;

    public SpeakerDiarizer(string segmentationModel, string embeddingModel)
    {
        var config = new OfflineSpeakerDiarizationConfig
        {
            Segmentation = new OfflineSpeakerSegmentationModelConfig
            {
                Pyannote = new OfflineSpeakerSegmentationPyannoteModelConfig { Model = segmentationModel },
                NumThreads = Threads,
                Provider = "cpu",
            },
            Embedding = new SpeakerEmbeddingExtractorConfig { Model = embeddingModel, NumThreads = Threads, Provider = "cpu" },
            Clustering = new FastClusteringConfig { NumClusters = -1, Threshold = ClusteringThreshold },
            MinDurationOn = 0.3f,
            MinDurationOff = 0.5f,
        };

        _diarization = new OfflineSpeakerDiarization(config);
    }

    public List<SpeakerSpan> Diarize(float[] samples) =>
        _diarization.Process(samples)
            .Select(segment => new SpeakerSpan(TimeSpan.FromSeconds(segment.Start), TimeSpan.FromSeconds(segment.End), segment.Speaker))
            .OrderBy(span => span.Start)
            .ToList();

    public void Dispose() => _diarization.Dispose();
}
