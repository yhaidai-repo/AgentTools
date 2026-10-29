// A task as `gsd-tools planning inspect` (schema_version 1) lists it; `kind` is not reliable (a tracer shows as auto).
export interface InspectTask {
  name: string;
  type?: string;
  plannedFiles?: string[];
  done?: string | null;
  status?: string;
}
