import type { ToolImage } from "./ToolImage";

export interface ToolResult {
  text: string;
  isError?: boolean;
  /** Images the model sees beside the text (a browser screenshot); most tools have none. */
  images?: ToolImage[];
}
