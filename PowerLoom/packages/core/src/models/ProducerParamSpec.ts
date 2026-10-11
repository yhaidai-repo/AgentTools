// One parameter a task producer takes, shown as a field on the schedule form. Only multi-choice lists so far.
export interface ProducerParamSpec {
  key: string;
  label: string;
  description: string;
  kind: "choices";
  /** The values offered, read when the form is shown (e.g. the vault folders). */
  choices(): Promise<string[]>;
  defaultValue: string[];
}
