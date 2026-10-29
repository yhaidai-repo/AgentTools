// The browser actions a GIF segment records a frame before; read-only tools (snapshot, screenshot) are not steps.
export const RECORDED_ACTIONS = new Set([
  "browser_click", "browser_type", "browser_fill_form", "browser_select_option", "browser_hover", "browser_press_key",
  "browser_navigate", "browser_navigate_back", "browser_type_secret", "browser_mouse_click_xy", "browser_drag",
  "browser_file_upload", "browser_handle_dialog",
]);
const MAX_VALUE = 200;

export function isClick(tool: string): boolean {
  return tool === "browser_click" || tool === "browser_mouse_click_xy";
}

/** What the timeline says about a step. A secret is never written: browser_type_secret records only that one was typed. */
export function describeStep(tool: string, input: Record<string, unknown>): { tool: string; label: string; value: string | null } {
  const element = typeof input.element === "string" ? input.element : "";

  if (tool === "browser_type_secret") {
    return { tool, label: `${element || "Field"} (secret typed by DevHub; value hidden)`, value: null };
  }

  return { tool, label: labelOf(tool, input, element), value: valueOf(tool, input) };
}

function labelOf(tool: string, input: Record<string, unknown>, element: string): string {
  if (tool === "browser_navigate") {
    return "Open " + pageOf(String(input.url ?? ""));
  }

  if (tool === "browser_fill_form") {
    return "Fill " + fieldsOf(input).map((field) => field.name).join(", ");
  }

  if (tool === "browser_press_key") {
    return "Press " + String(input.key ?? "");
  }

  return element || tool.replace("browser_", "").replace(/_/g, " ");
}

function valueOf(tool: string, input: Record<string, unknown>): string | null {
  if (tool === "browser_type") {
    return cut(String(input.text ?? ""));
  }

  if (tool === "browser_fill_form") {
    return cut(fieldsOf(input).map((field) => `${field.name}: ${field.value}`).join("; "));
  }

  if (tool === "browser_select_option" && Array.isArray(input.values)) {
    return cut(input.values.map(String).join(", "));
  }

  return null;
}

function fieldsOf(input: Record<string, unknown>): { name: string; value: string }[] {
  const fields = Array.isArray(input.fields) ? input.fields as Record<string, unknown>[] : [];

  return fields.map((field) => ({ name: String(field.name ?? "field"), value: String(field.value ?? "") }));
}

// Query and fragment can carry tokens: the timeline keeps origin and path only.
function pageOf(url: string): string {
  try {
    const parsed = new URL(url);

    return parsed.origin + parsed.pathname;
  } catch {
    return "page";
  }
}

const cut = (value: string) => value.slice(0, MAX_VALUE);
