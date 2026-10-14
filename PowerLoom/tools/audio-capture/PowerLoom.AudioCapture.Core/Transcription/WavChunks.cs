using NAudio.Wave;
using PowerLoom.AudioCapture.Live;
using PowerLoom.AudioCapture.Models;

namespace PowerLoom.AudioCapture.Transcription;

// A finished 16 kHz mono WAV cut into speech chunks by the same pause detector the live view uses: Whisper only ever
// sees stretches where someone talks, so silence can't make it invent text.
public static class WavChunks
{
    private const int BlockSamples = 800;

    public static List<SpeechChunk> Read(string wavPath, string speaker)
    {
        var chunker = new SpeechChunker(speaker);
        var chunks = new List<SpeechChunk>();

        chunker.Chunk += chunks.Add;
        ReadThrough(wavPath, chunker);
        chunker.Flush();

        return chunks;
    }

    private static void ReadThrough(string wavPath, SpeechChunker chunker)
    {
        using var reader = new WaveFileReader(wavPath);

        var samples = reader.ToSampleProvider();
        var block = new float[BlockSamples];
        var read = samples.Read(block);

        while (read > 0)
        {
            chunker.Add(block.AsSpan(0, read));
            read = samples.Read(block);
        }
    }
}
