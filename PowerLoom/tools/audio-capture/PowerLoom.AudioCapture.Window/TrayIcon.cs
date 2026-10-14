using System.Drawing;
using System.Windows.Forms;

namespace PowerLoom.AudioCapture.Ui;

// The notification-area icon: grey microphone dot when idle, red while recording; menu Open / Start-Stop / Quit.
public sealed class TrayIcon : IDisposable
{
    private readonly NotifyIcon _icon = new();
    private readonly Icon _idle = Draw(Color.FromArgb(0x6B, 0x72, 0x80));
    private readonly Icon _recording = Draw(Color.FromArgb(0xDC, 0x26, 0x26));
    private readonly ToolStripMenuItem _toggle = new("Start recording");

    public TrayIcon(Action open, Action toggle, Action quit)
    {
        var menu = new ContextMenuStrip();

        menu.Items.Add("Open", null, (_, _) => open());
        menu.Items.Add(_toggle);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Quit", null, (_, _) => quit());
        _toggle.Click += (_, _) => toggle();

        _icon.Icon = _idle;
        _icon.Text = "PowerLoom audio capture";
        _icon.ContextMenuStrip = menu;
        _icon.DoubleClick += (_, _) => open();
        _icon.Visible = true;
    }

    public void SetRecording(bool recording)
    {
        _icon.Icon = recording ? _recording : _idle;
        _icon.Text = recording ? "PowerLoom audio capture: recording" : "PowerLoom audio capture";
        _toggle.Text = recording ? "Stop recording" : "Start recording";
    }

    public void Notify(string title, string text) => _icon.ShowBalloonTip(3000, title, text, ToolTipIcon.None);

    public void Dispose()
    {
        _icon.Visible = false;
        _icon.Dispose();
        _idle.Dispose();
        _recording.Dispose();
    }

    private static Icon Draw(Color color)
    {
        using var bitmap = new Bitmap(32, 32);
        using var graphics = Graphics.FromImage(bitmap);
        using var brush = new SolidBrush(color);

        graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        graphics.FillEllipse(brush, 4, 4, 24, 24);

        return Icon.FromHandle(bitmap.GetHicon());
    }
}
