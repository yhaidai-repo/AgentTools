// Whether a provider is connected, at a glance: a lit dot and "Connected", or a pulsing one and "Not connected".
// Unknown (PowerLoom unreachable) says so instead of guessing.
export function ConnectionBadge({ connected }: { connected: boolean | null }) {
  const [dot, label] = connected === null ? ["dot", "Unknown"] : connected ? ["dot ok", "Connected"] : ["dot warn", "Not connected"];

  return <span className={`connection-badge${connected === false ? " off" : ""}`}><span className={dot} aria-hidden="true" />{label}</span>;
}
