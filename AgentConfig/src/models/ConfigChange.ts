export interface ConfigChange {
  kind: "agent" | "global";
  /** Agent id for kind "agent". */
  id: string | null;
}
