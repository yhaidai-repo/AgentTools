const TICK_STEPS = [1, 2, 2.5, 5, 10];

// Every chart draws its columns this wide, whatever the number of days (user, 2026-10-18: bars look alike across tabs);
// a crowded chart narrows them to fit.
export const BAR_WIDTH = 14;

export const BAR_GAP = 3;

export interface Ticks {
  values: number[];
  max: number;
}

// Round tick values that cover `max`: 0 / 10 / 20 rather than 0 / 8.3 / 16.6.
export function niceTicks(max: number, count: number): Ticks {
  if (max <= 0) {
    return { values: [0], max: 0 };
  }

  const step = niceStep(max / count);
  const top = Math.ceil(max / step) * step;
  const values = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => roundTo(index * step, step));

  return { values, max: top };
}

function niceStep(rough: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const multiplier = TICK_STEPS.find((candidate) => candidate * magnitude >= rough) ?? 10;

  return multiplier * magnitude;
}

// Avoids 0.30000000000000004 as a tick.
function roundTo(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);

  return Number(value.toFixed(decimals));
}

export interface ColumnLayout {
  width: number;
  offset: (index: number) => number;
}

// Columns centred in equal slots, never wider than `maxWidth`: the slot's leftover is air.
export function columnLayout(count: number, plotWidth: number, maxWidth: number): ColumnLayout {
  const slot = count > 0 ? plotWidth / count : plotWidth;
  const width = Math.max(Math.min(slot * 0.7, maxWidth), 2);

  return { width, offset: (index) => index * slot + (slot - width) / 2 };
}
