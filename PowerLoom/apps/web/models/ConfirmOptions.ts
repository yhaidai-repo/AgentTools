// What a confirm window says: a short title, the consequences, and the label of the button that goes ahead.
export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  /** The action destroys or stops something: the button is rose and the window starts on Cancel. */
  isDanger?: boolean;
}
