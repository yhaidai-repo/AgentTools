import { formatPercent, formatTokens } from "@/lib/format";
import { loadPbiContextSize } from "@/lib/pbiContextSize";
import type { PbiDetail } from "@/lib/pbiDetail";

// The header chip: how big the context is that every agent run and chat on this PBI starts with, and which part weighs
// what (user request 2026-10-13), so a growing PBI shows before its runs get expensive.
export async function ContextSize({ pbi }: { pbi: PbiDetail["pbi"] }) {
  const size = await loadPbiContextSize(pbi);

  return (
    <details className="context-size">
      <summary className="chip">agent context ≈ {formatTokens(size.tokens)} tokens</summary>
      <table>
        <thead>
          <tr><th>Part</th><th>Characters</th><th>≈ Tokens</th><th>Share</th></tr>
        </thead>
        <tbody>
          {size.parts.map((part) => (
            <tr key={part.name}><td>{part.name}</td><td>{part.chars.toLocaleString("en-US")}</td><td>{formatTokens(part.tokens)}</td><td>{share(part.chars, size.chars)}</td></tr>
          ))}
          <tr><th>Total</th><th>{size.chars.toLocaleString("en-US")}</th><th>{formatTokens(size.tokens)}</th><th>100%</th></tr>
        </tbody>
      </table>
      <p className="muted">Estimated at 4 characters per token. References an agent reads on top (read_pbi, attachments) come in addition.</p>
    </details>
  );
}

function share(chars: number, total: number): string {
  return total === 0 ? "–" : formatPercent(chars / total);
}
