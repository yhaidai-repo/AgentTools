import { api, byId, escapeHtml, showMessage } from "./core.js";

// The named values (values.*.json): masked, Show / Copy on request; add, replace, delete.

// The bridge's own token: changed in the file and by restarting the bridge, never here.
const READ_ONLY_VALUES = ["stack-bridge-token"];

export async function renderSecrets(section, filterText = "") {
  const files = await api("/config/secrets");

  section.innerHTML = `
    <div class="toolbar"><input id="secret-filter" placeholder="Filter by name or project"></div>
    <div id="secret-files"></div>`;

  const filter = byId("secret-filter");
  const draw = () => drawSecretFiles(files, filter.value.trim().toLowerCase());

  filter.value = filterText;
  filter.addEventListener("input", draw);
  draw();
}

// After a change: the list again, with the same filter, and the outcome under the file's card.
async function reloadSecrets(file, message, isError) {
  await renderSecrets(byId("secrets"), byId("secret-filter")?.value ?? "");

  showMessage(byId(`secret-message-${file}`), message, isError);
}

function drawSecretFiles(files, filter) {
  byId("secret-files").innerHTML = files.map((file) => {
    const secrets = file.secrets.filter((secret) => !filter || JSON.stringify(secret).toLowerCase().includes(filter));

    return `
      <div class="card">
        <h2>values.${escapeHtml(file.file)}.json ${file.extends ? `<span class="muted">overrides values.${escapeHtml(file.extends)}.json</span>` : ""}</h2>
        ${secrets.length === 0 ? `<p class="muted">No values${filter ? " match" : ""}.</p>` : secretTable(secrets)}
        ${addSecretForm(file.file)}
        <p id="secret-message-${escapeHtml(file.file)}"></p>
      </div>`;
  }).join("");

  document.querySelectorAll("[data-show]").forEach((button) => button.addEventListener("click", () => showSecret(button)));
  document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", () => copySecret(button)));
  document.querySelectorAll("[data-replace]").forEach((button) => button.addEventListener("click", () => openReplace(button)));
  document.querySelectorAll("[data-delete]").forEach((button) => button.addEventListener("click", () => deleteSecret(button)));
  document.querySelectorAll("form[data-add]").forEach((form) => form.addEventListener("submit", (event) => addSecret(event, form)));
}

function addSecretForm(file) {
  return `
    <form class="toolbar" data-add="${escapeHtml(file)}">
      <input name="name" placeholder="new-value-name" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="64" required>
      <input name="value" type="password" autocomplete="off" placeholder="value">
      <button type="submit" class="small">Add or replace</button>
    </form>`;
}

function secretTable(secrets) {
  const rows = secrets.map((secret) => `
    <tr>
      <td class="mono">${escapeHtml(secret.name)}</td>
      <td>${secretState(secret)}<div class="secret-value mono" id="value-${escapeHtml(secret.file)}-${escapeHtml(secret.name)}"></div></td>
      <td>${secret.usedBy.length === 0 ? `<span class="warning">unused</span>` : `<details><summary>${secret.usedBy.length} setting(s)</summary>${secret.usedBy.map((use) => `<div class="mono muted">${escapeHtml(use)}</div>`).join("")}</details>`}</td>
      <td>${secretActions(secret)}</td>
    </tr>`).join("");

  return `<table><thead><tr><th>Name</th><th>Value</th><th>Used by</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function secretActions(secret) {
  const id = `${escapeHtml(secret.file)}|${escapeHtml(secret.name)}`;
  const view = `<button class="small secondary" data-show="${id}">Show</button> <button class="small secondary" data-copy="${id}">Copy</button>`;

  if (READ_ONLY_VALUES.includes(secret.name)) {
    return `${view} <span class="muted" title="Change it in the file, restart the bridge, update PowerLoom's Local stack settings">read-only</span>`;
  }

  return `${view} <button class="small secondary" data-replace="${id}">Replace</button> <button class="small secondary" data-delete="${id}">Delete</button>`;
}

function secretState(secret) {
  if (secret.state === "set") {
    return `<span class="muted">•••••••• (${secret.length} chars)</span>`;
  }

  return `<span class="warning">${escapeHtml(secret.state)}</span>`;
}

async function readSecret(button, attribute) {
  const [file, name] = button.getAttribute(attribute).split("|");

  return { file, name, secret: await api(`/config/secrets/${encodeURIComponent(file)}/${encodeURIComponent(name)}`) };
}

async function showSecret(button) {
  const { file, name, secret } = await readSecret(button, "data-show");
  const target = byId(`value-${file}-${name}`);
  const isShown = target.textContent.length > 0;

  target.textContent = isShown ? "" : secret.value;
  button.textContent = isShown ? "Show" : "Hide";
}

async function copySecret(button) {
  const { secret } = await readSecret(button, "data-copy");

  await navigator.clipboard.writeText(secret.value);
  button.textContent = "Copied";
  setTimeout(() => { button.textContent = "Copy"; }, 1500);
}

function openReplace(button) {
  const [file, name] = button.getAttribute("data-replace").split("|");
  const target = byId(`value-${file}-${name}`);

  target.innerHTML = `
    <form class="toolbar">
      <input name="value" type="password" autocomplete="off" placeholder="new value">
      <button type="submit" class="small">Save</button>
      <button type="button" class="small secondary" data-cancel>Cancel</button>
    </form>`;

  const form = target.querySelector("form");

  form.querySelector("[data-cancel]").addEventListener("click", () => { target.innerHTML = ""; });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveSecret(file, name, form.elements.value.value, `${name} replaced.`);
  });
  form.elements.value.focus();
}

function addSecret(event, form) {
  event.preventDefault();

  const name = form.elements.name.value.trim();

  saveSecret(form.getAttribute("data-add"), name, form.elements.value.value, `${name} saved.`);
}

async function saveSecret(file, name, value, success) {
  try {
    await api(`/config/secrets/${encodeURIComponent(file)}/${encodeURIComponent(name)}`, "PUT", { value });
    await reloadSecrets(file, success, false);
  } catch (error) {
    await reloadSecrets(file, error.message, true);
  }
}

async function deleteSecret(button) {
  const [file, name] = button.getAttribute("data-delete").split("|");

  if (!confirm(`Delete ${name} from values.${file}.json? A backup of the file is kept.`)) {
    return;
  }

  try {
    await api(`/config/secrets/${encodeURIComponent(file)}/${encodeURIComponent(name)}`, "DELETE");
    await reloadSecrets(file, `${name} deleted.`, false);
  } catch (error) {
    await reloadSecrets(file, error.message, true);
  }
}
