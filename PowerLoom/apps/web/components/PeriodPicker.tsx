import { SegLinks } from "@/components/SegLinks";
import { rangeOptions } from "@/lib/ranges";

// The one period switch every page shows, the same periods and the same size (user decision 2026-10-18); the choice is
// remembered per vault.
export function PeriodPicker({ value, path, keep }: { value: string; path: string; keep: Record<string, string> }) {
  return <SegLinks name="range" value={value} options={rangeOptions()} path={path} keep={keep} small />;
}
