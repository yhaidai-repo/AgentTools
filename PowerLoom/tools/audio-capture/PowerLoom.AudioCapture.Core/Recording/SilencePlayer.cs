using NAudio.CoreAudioApi;
using NAudio.Wave;

namespace PowerLoom.AudioCapture.Recording;

// Plays silence on the output the loopback captures, so WASAPI loopback keeps delivering buffers while nothing else plays
// there (without a render stream on that very device the loopback gets no data at all).
public sealed class SilencePlayer : IDisposable
{
    private readonly WasapiPlayer _output;

    public SilencePlayer(MMDevice output)
    {
        _output = new WasapiPlayerBuilder().WithDevice(output).WithSharedMode().WithLatency(200).Build();
    }

    public void Start()
    {
        _output.Init(new SilenceProvider(_output.OutputWaveFormat));
        _output.Play();
    }

    public void Stop() => _output.Stop();

    public void Dispose() => _output.Dispose();
}
