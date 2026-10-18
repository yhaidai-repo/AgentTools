// One part of a stacked bar: its count, its name in the tooltip and legend, and the class that colours it.
export interface BarPart {
  value: number;
  label: string;
  className: string;
}
