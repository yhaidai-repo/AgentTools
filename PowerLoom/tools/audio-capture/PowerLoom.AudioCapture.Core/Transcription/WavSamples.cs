using NAudio.Wave;

namespace PowerLoom.AudioCapture.Transcription;

public static class WavSamples
{
    private const int BlockSamples = 16000;

    // The whole 16 kHz mono file as floats (a one-hour meeting is 230 MB; fine for a one-off pass).
    public static float[] ReadAll(string wavPath)
    {
        using var reader = new WaveFileReader(wavPath);

        var samples = reader.ToSampleProvider();
        var all = new List<float>((int)(reader.TotalTime.TotalSeconds * BlockSamples) + BlockSamples);
        var block = new float[BlockSamples];
        var read = samples.Read(block);

        while (read > 0)
        {
            all.AddRange(block.AsSpan(0, read));
            read = samples.Read(block);
        }

        return all.ToArray();
    }
}
