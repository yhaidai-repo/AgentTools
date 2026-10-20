export type BrowserActionKind = "navigate" | "click" | "fill" | "press" | "select" | "check" | "uncheck" | "hover";

// POST /browser/act: the action and its target (role + name, label, text, placeholder or a CSS selector).
// `valueName` names a dev-secrets value DevHub types instead of `value`, so a password never reaches the agent.
export interface BrowserAction {
  action: BrowserActionKind;
  url?: string;
  role?: string;
  name?: string;
  label?: string;
  text?: string;
  placeholder?: string;
  selector?: string;
  exact?: boolean;
  value?: string;
  valueName?: string;
  key?: string;
}
