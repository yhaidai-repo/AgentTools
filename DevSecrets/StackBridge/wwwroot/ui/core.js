// What every tab shares: the bridge token, the API calls, HTML escaping and the token form.

export const TABS = ["apps", "dependencies", "secrets", "problems"];

const TOKEN_KEY = "devsecrets-bridge-token";

export const byId = (id) => document.getElementById(id);

export function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function token() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function saveToken(value) {
  sessionStorage.setItem(TOKEN_KEY, value);
}

export function forgetToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function api(path, method = "GET", body = undefined) {
  const headers = { Authorization: `Bearer ${token()}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) };
  const response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

  if (response.status === 401) {
    forgetToken();
    showTokenForm("The bridge refused the token.");
    throw new Error("unauthorized");
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.detail ?? `${response.status} ${response.statusText}`);
  }

  const text = await response.text();

  return text ? JSON.parse(text) : null;
}

export function showTokenForm(message) {
  byId("token-form").hidden = false;
  byId("tabs").hidden = true;
  byId("sign-out").hidden = true;
  TABS.forEach((tab) => { byId(tab).hidden = true; });
  byId("token-error").hidden = !message;
  byId("token-error").textContent = message ?? "";
}

// A change answer under a form: green, or red with the reason.
export function showMessage(target, message, isError) {
  target.textContent = message;
  target.className = isError ? "error" : "ok";
}

// Saving a change to services.json or map.json runs the scripts' check first; that takes a few seconds.
export async function submitChange(button, messageTarget, call, success) {
  const label = button.textContent;

  button.disabled = true;
  button.textContent = "Checking…";

  try {
    await call();
    return success;
  } catch (error) {
    showMessage(messageTarget, error.message, true);
    return null;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

export function shortProject(project) {
  return (project ?? "").split("/").pop();
}
