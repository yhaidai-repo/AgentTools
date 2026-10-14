using NAudio.Wave;

namespace PowerLoom.AudioCapture.Transcription;

public static class WavDuration
{
    public static double Seconds(string wavPath)
    {
        using var reader = new WaveFileReader(wavPath);

        return reader.TotalTime.TotalSeconds;
    }
}
