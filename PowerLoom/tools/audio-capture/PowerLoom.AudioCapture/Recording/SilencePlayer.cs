using NAudio.Wave;

namespace PowerLoom.AudioCapture.Recording;

// Plays silence on the default output so WASAPI loopback keeps delivering buffers while nothing else plays.
public sealed class SilencePlayer : IDisposable
{
    private readonly WasapiPlayer _output = new WasapiPlayerBuilder().WithSharedMode().WithLatency(200).Build();

    public void Start()
    {
        _output.Init(new SilenceProvider(_output.OutputWaveFormat));
        _output.Play();
    }

    public void Stop() => _output.Stop();

    public void Dispose() => _output.Dispose();
}
