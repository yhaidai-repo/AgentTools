import { api, byId, escapeHtml, showMessage, submitChange } from "./core.js";

// Who calls whom, and every project's settings (map.json): add a project, add, change or delete a setting. A setting
// reads a named value, or calls another app (local while that app runs in the stack, else the remote value).

const PARTS = ["url", "key", "user"];

let state = { view: null, apps: [], valueNames: [] };

export async function renderDependencies(section) {
  const [view, apps, secrets] = await Promise.all([api("/config/dependencies"), api("/config/apps"), api("/config/secrets")]);

  state = { view, apps: apps.map((app) => app.name), valueNames: [...new Set(secrets.flatMap((file) => file.secrets.map((secret) => secret.name)))].sort() };
  section.innerHTML = `
    <div class="card">
      <h2>Who calls whom</h2>
      <p class="muted">A call goes to localhost while the called app runs in the same stack, otherwise to Azure dev. Hover a chip for the settings that carry it.</p>
      <div class="calls">${view.apps.map(callRow).join("")}</div>
    </div>
    <div class="card">
      <div class="toolbar"><h2>Project settings</h2><input id="project-filter" placeholder="Filter by project, key or value"></div>
      ${addProjectForm()}
      <p id="dependencies-message"></p>
      <div id="project-list"></div>
    </div>
    <datalist id="value-names">${state.valueNames.map((name) => `<option value="${escapeHtml(name)}">`).join("")}</datalist>`;

  const filter = byId("project-filter");

  filter.addEventListener("input", () => drawProjects(filter.value.trim().toLowerCase()));
  byId("add-project-form").addEventListener("submit", addProject);
  drawProjects("");
}

function callRow(app) {
  const chips = app.calls.map((call) => `<span class="chip ref" title="${escapeHtml(call.keys.join("\n"))}">${escapeHtml(call.service)}</span>`).join("");

  return `<div><strong>${escapeHtml(app.app)}</strong> calls</div><div>${chips}</div>`;
}

function addProjectForm() {
  return `
    <form id="add-project-form" class="toolbar">
      <input name="project" placeholder="pvs/PVS/PVS.Something/PVS.Something.csproj" required>
      <select name="app">${state.apps.map((app) => `<option>${escapeHtml(app)}</option>`).join("")}</select>
      <button type="submit" class="small">Add project</button>
    </form>`;
}

function drawProjects(filter) {
  const visible = state.view.projects.filter((project) => !filter || JSON.stringify(project).toLowerCase().includes(filter));

  byId("project-list").innerHTML = visible.map((project, index) => projectBlock(project, index, filter)).join("") || `<p class="muted">No project matches.</p>`;
  byId("project-list").querySelectorAll("[data-add-setting]").forEach((button) => button.addEventListener("click", () => openSettingForm(button.dataset.addSetting, null)));
  byId("project-list").querySelectorAll("[data-edit-setting]").forEach((button) => button.addEventListener("click", () => openSettingForm(button.dataset.project, button.dataset.editSetting)));
  byId("project-list").querySelectorAll("[data-delete-setting]").forEach((button) => button.addEventListener("click", () => deleteSetting(button)));
  byId("project-list").querySelectorAll("[data-delete-project]").forEach((button) => button.addEventListener("click", () => deleteProject(button)));
}

function projectBlock(project, index, filter) {
  return `
    <details ${filter ? "open" : ""}>
      <summary><h3 class="mono">${escapeHtml(project.project)}</h3> <span class="muted">${escapeHtml(project.app ?? "no app")} · ${project.settings.length} settings</span></summary>
      <table>
        <thead><tr><th>Key</th><th>Source</th><th></th></tr></thead>
        <tbody>${project.settings.map((setting) => settingRow(project.project, setting)).join("")}</tbody>
      </table>
      <div class="toolbar">
        <button class="small" data-add-setting="${escapeHtml(project.project)}">Add setting</button>
        <button class="small secondary" data-delete-project="${escapeHtml(project.project)}">Delete project</button>
      </div>
      <div id="setting-form-${index}" data-setting-form="${escapeHtml(project.project)}"></div>
    </details>`;
}

function settingRow(project, setting) {
  const ids = `data-project="${escapeHtml(project)}"`;

  return `
    <tr>
      <td class="mono">${escapeHtml(setting.key)}</td>
      <td>${settingSource(setting)}</td>
      <td>
        <button class="small secondary" ${ids} data-edit-setting="${escapeHtml(setting.key)}">Edit</button>
        <button class="small secondary" ${ids} data-delete-setting="${escapeHtml(setting.key)}">Delete</button>
      </td>
    </tr>`;
}

function settingSource(setting) {
  if (!setting.service) {
    return `<span class="chip">${escapeHtml(setting.valueName)}</span>`;
  }

  const remote = setting.remoteValue ? ` <span class="muted">else</span> <span class="chip">${escapeHtml(setting.remoteValue)}</span>` : ` <span class="muted">always local</span>`;

  return `<span class="chip local">${escapeHtml(setting.service)} ${escapeHtml(setting.part)}</span>${remote}`;
}

// --- Setting form ---

function openSettingForm(project, key) {
  const setting = state.view.projects.find((entry) => entry.project === project).settings.find((entry) => entry.key === key) ?? {};
  const target = [...document.querySelectorAll("[data-setting-form]")].find((element) => element.dataset.settingForm === project);
  const isCall = Boolean(setting.service);

  target.innerHTML = `
    <form class="card">
      <div class="form-grid">
        <label>Key<input name="key" value="${escapeHtml(key)}" ${key ? "readonly" : ""} placeholder="ConnectionStrings:cache" required></label>
        <label class="inline"><input type="radio" name="source" value="value" ${isCall ? "" : "checked"}> A named value</label>
        <label class="inline"><input type="radio" name="source" value="call" ${isCall ? "checked" : ""}> A call to an app</label>
        <label data-source="value">Value name<input name="valueName" value="${escapeHtml(setting.valueName)}" list="value-names"></label>
        <label data-source="call">App<select name="service">${state.apps.map((app) => `<option ${app === setting.service ? "selected" : ""}>${escapeHtml(app)}</option>`).join("")}</select></label>
        <label data-source="call">Reads its<select name="part">${PARTS.map((part) => `<option ${part === setting.part ? "selected" : ""}>${part}</option>`).join("")}</select></label>
        <label data-source="call">Else (app not local) the value<input name="remoteValue" value="${escapeHtml(setting.remoteValue)}" list="value-names" placeholder="empty: always the local one"></label>
      </div>
      <div class="toolbar"><button type="submit" class="small">Save</button><button type="button" class="small secondary" data-cancel>Cancel</button></div>
      <p data-message></p>
    </form>`;

  const form = target.querySelector("form");

  form.querySelectorAll("input[name=source]").forEach((radio) => radio.addEventListener("change", () => showSource(form)));
  form.querySelector("[data-cancel]").addEventListener("click", () => { target.innerHTML = ""; });
  form.addEventListener("submit", (event) => saveSetting(event, project));
  showSource(form);
}

function showSource(form) {
  const source = new FormData(form).get("source");

  form.querySelectorAll("[data-source]").forEach((field) => { field.hidden = field.dataset.source !== source; });
}

function settingRequest(form, project) {
  const data = new FormData(form);
  const isCall = data.get("source") === "call";

  return {
    project,
    key: String(data.get("key")).trim(),
    valueName: isCall ? null : data.get("valueName"),
    service: isCall ? data.get("service") : null,
    part: isCall ? data.get("part") : null,
    remoteValue: isCall ? data.get("remoteValue") : null,
  };
}

async function saveSetting(event, project) {
  event.preventDefault();

  const form = event.target;
  const request = settingRequest(form, project);
  const done = await submitChange(form.querySelector("button[type=submit]"), form.querySelector("[data-message]"), () => api("/config/settings", "PUT", request), `${request.key} saved in ${project}.`);

  await reloadAfter(done);
}

async function deleteSetting(button) {
  const { project, deleteSetting: key } = button.dataset;

  if (!confirm(`Delete ${key} from ${project}?`)) {
    return;
  }

  const done = await submitChange(button, byId("dependencies-message"), () => api(`/config/settings?project=${encodeURIComponent(project)}&key=${encodeURIComponent(key)}`, "DELETE"), `${key} deleted from ${project}.`);

  await reloadAfter(done);
}

async function addProject(event) {
  event.preventDefault();

  const form = event.target;
  const data = new FormData(form);
  const request = { project: String(data.get("project")).trim(), app: data.get("app") };
  const done = await submitChange(form.querySelector("button[type=submit]"), byId("dependencies-message"), () => api("/config/projects", "PUT", request), `${request.project} added to ${request.app}.`);

  await reloadAfter(done);
}

async function deleteProject(button) {
  const project = button.dataset.deleteProject;

  if (!confirm(`Delete ${project} and all its settings from map.json?`)) {
    return;
  }

  const done = await submitChange(button, byId("dependencies-message"), () => api(`/config/projects?project=${encodeURIComponent(project)}`, "DELETE"), `${project} deleted.`);

  await reloadAfter(done);
}

// After a change: the tab again, with the same filter, and the outcome on top.
async function reloadAfter(done) {
  if (!done) {
    return;
  }

  const filter = byId("project-filter").value;

  await renderDependencies(byId("dependencies"));
  byId("project-filter").value = filter;
  drawProjects(filter.trim().toLowerCase());
  showMessage(byId("dependencies-message"), done, false);
}
