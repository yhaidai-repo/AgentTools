import type { ConfirmOptions } from "./ConfirmOptions";

// One window the page was asked to show: a question (Cancel and confirm) or a notice (OK only).
export interface DialogRequest {
  options: ConfirmOptions;
  isNotice: boolean;
  resolve: (accepted: boolean) => void;
}
