using System.Runtime.InteropServices;

namespace PowerLoom.AudioCapture.Daemon;

// A system-wide hotkey ("Ctrl+Alt+R") on its own message-loop thread; the callback runs on that thread.
public sealed class GlobalHotkey : IDisposable
{
    private const int HotkeyId = 1;
    private const uint WmHotkey = 0x0312;
    private const uint WmQuit = 0x0012;
    private const uint ModNoRepeat = 0x4000;

    private readonly Thread _thread;
    private uint _threadId;

    private GlobalHotkey(uint modifiers, uint key, Action pressed)
    {
        _thread = new Thread(() => MessageLoop(modifiers, key, pressed)) { IsBackground = true, Name = "hotkey" };
        _thread.Start();
    }

    public static GlobalHotkey Register(string hotkey, Action pressed)
    {
        var (modifiers, key) = HotkeyParser.Parse(hotkey);

        return new GlobalHotkey(modifiers, key, pressed);
    }

    public void Dispose()
    {
        if (_threadId != 0)
            PostThreadMessage(_threadId, WmQuit, IntPtr.Zero, IntPtr.Zero);
    }

    private void MessageLoop(uint modifiers, uint key, Action pressed)
    {
        _threadId = GetCurrentThreadId();

        if (!RegisterHotKey(IntPtr.Zero, HotkeyId, modifiers | ModNoRepeat, key))
        {
            Log.Info($"Hotkey not registered (Win32 error {Marshal.GetLastWin32Error()}, another app may hold it); the CLI still works, `install --hotkey` picks another one");

            return;
        }

        while (GetMessage(out var message, IntPtr.Zero, 0, 0) > 0)
        {
            if (message.Message == WmHotkey)
                pressed();
        }

        UnregisterHotKey(IntPtr.Zero, HotkeyId);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Msg
    {
        public IntPtr Hwnd;
        public uint Message;
        public IntPtr WParam;
        public IntPtr LParam;
        public uint Time;
        public int X;
        public int Y;
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint modifiers, uint key);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("user32.dll")]
    private static extern int GetMessage(out Msg message, IntPtr hWnd, uint filterMin, uint filterMax);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool PostThreadMessage(uint threadId, uint message, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();
}
