// One part of a stacked column: one series, or neighbours that share a colour (their labels and values together).
export interface StackSegment {
  key: string;
  label: string;
  color: string;
  value: number;
  /** Each joined series' own value, bottom-up. */
  values: number[];
  /** The part's upper edge, counted from the baseline. */
  top: number;
}
