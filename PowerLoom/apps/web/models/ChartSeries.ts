// One series of a chart: a value per slot of the x axis, in the slots' order. `color` is a CSS color (a series or a
// status variable), so identity follows the entity, not its position.
export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}
