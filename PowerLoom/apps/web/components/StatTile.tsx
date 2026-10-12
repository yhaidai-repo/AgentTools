// One number with its label and a note under it (the dashboard's tiles); `alert` paints the number as a problem.
export function StatTile({ label, value, note, alert = false }: { label: string; value: string; note?: string; alert?: boolean }) {
  return (
    <div className="card stat-tile">
      <span className="stat-label">{label}</span>
      <strong className={`stat-value${alert ? " result-error" : ""}`}>{value}</strong>
      {note && <span className="muted">{note}</span>}
    </div>
  );
}
