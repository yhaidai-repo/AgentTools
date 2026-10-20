namespace DevSecrets.DevHub.Models;

// What the page shows after a call: its address, title and the accessibility snapshot (roles and names the next
// action targets). A long snapshot is cut; `SnapshotCut` says so.
public sealed record BrowserView(string Url, string Title, string Snapshot, bool SnapshotCut);
