using System;
using System.Threading;
using Outlook = Microsoft.Office.Interop.Outlook;

// Loaded by Export-PowerLoomMail.ps1 with Add-Type. The wait pumps COM messages on PowerShell's STA thread, which is
// how Outlook's SyncEnd event gets through while it waits.
public static class SendReceive
{
    // True when the send/receive group ended within the timeout.
    public static bool Run(object syncObject, int timeoutSeconds)
    {
        var events = (Outlook.SyncObjectEvents_Event)syncObject;
        var ended = new ManualResetEvent(false);
        Outlook.SyncObjectEvents_SyncEndEventHandler onEnd = () => ended.Set();

        events.SyncEnd += onEnd;

        try
        {
            ((Outlook.SyncObject)syncObject).Start();

            return ended.WaitOne(TimeSpan.FromSeconds(timeoutSeconds));
        }
        finally
        {
            events.SyncEnd -= onEnd;
        }
    }
}
