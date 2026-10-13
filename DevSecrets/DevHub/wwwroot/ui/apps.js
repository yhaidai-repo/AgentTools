import { api, byId, escapeHtml, shortProject, showMessage, submitChange } from "./core.js";

// The apps of services.json: what each is, what it starts and when it is ready; add, change, delete. A save is checked by
// the scripts first and refused when it would break a start.

let state = { apps: [], projects: [] };

export async function renderApps(section) {
  const [apps, dependencies] = await Promise.all([api("/config/apps"), api("/config/dependencies")]);

  state = { apps, projects: dependencies.projects };
  section.innerHTML = `
    <div class="card">
      <div class="toolbar">
        <p class="muted">${apps.length} apps from <code>services.json</code>. A stack starts each app's run project; its projects get their settings from <code>map.json</code>.</p>
        <button id="add-app" class="small">Add app</button>
      </div>
      <table>
        <thead><tr><th>App</th><th>Local URL</th><th>Starts</th><th>Ready when</th><th>Bus</th><th>Projects</th><th></th></tr></thead>
        <tbody>${apps.map(appRow).join("")}</tbody>
      </table>
      <p id="apps-message"></p>
    </div>
    <div id="app-editor"></div>`;

  byId("add-app").addEventListener("click", () => openEditor(null));
  section.querySelectorAll("[data-edit-app]").forEach((button) => button.addEventListener("click", () => openEditor(button.dataset.editApp)));
  section.querySelectorAll("[data-delete-app]").forEach((button) => button.addEventListener("click", () => deleteApp(button)));
}

function appRow(app) {
  return `
    <tr>
      <td><strong>${escapeHtml(app.name)}</strong><div class="muted">${escapeHtml(app.note)}</div></td>
      <td class="mono">${escapeHtml(app.localUrl ?? "—")}${app.localKey ? `<div class="muted">key ${escapeHtml(app.localKey)}</div>` : ""}</td>
      <td>${runText(app.run)}</td>
      <td>${readyText(app)}</td>
      <td>${app.consumesBus ? `<span class="chip">local RabbitMQ</span>` : ""}</td>
      <td>${app.projects.map((project) => `<div class="mono" title="${escapeHtml(project)}">${escapeHtml(shortProject(project))}</div>`).join("") || `<span class="muted">none</span>`}</td>
      <td class="row-actions">
        <button class="small secondary" data-edit-app="${escapeHtml(app.name)}">Edit</button>
        <button class="small secondary" data-delete-app="${escapeHtml(app.name)}">Delete</button>
      </td>
    </tr>`;
}

function runText(run) {
  if (!run) {
    return `<span class="muted">not runnable</span>`;
  }

  if (run.kind) {
    return `<span class="chip">${escapeHtml(run.kind)}</span>`;
  }

  const env = Object.entries(run.requiresEnv ?? {}).map(([name, value]) => `<div class="muted">needs ${escapeHtml(name)}=${escapeHtml(value)}</div>`).join("");

  return `<div class="mono" title="${escapeHtml(run.project)}">${escapeHtml(shortProject(run.project))}</div><div class="muted">profile ${escapeHtml(run.launchProfile)}</div>${env}`;
}

function readyText(app) {
  const run = app.run;

  if (!run) {
    return "";
  }

  const conditions = [run.readyLog ? `log shows “${run.readyLog}”` : null, !run.readyLog && app.localUrl ? "URL answers" : null, run.readyProcess ? `process ${run.readyProcess} runs` : null];

  return conditions.filter(Boolean).map(escapeHtml).join("<br>");
}

// --- Editor ---

function openEditor(name) {
  const app = state.apps.find((entry) => entry.name === name) ?? { name: "", projects: [], run: { requiresEnv: {} } };
  const run = app.run ?? {};
  const isNew = name === null;

  byId("app-editor").innerHTML = `
    <form class="card" id="app-form">
      <h2>${isNew ? "Add app" : `Edit ${escapeHtml(app.name)}`}</h2>
      <div class="form-grid">
        <label>Name<input name="name" value="${escapeHtml(app.name)}" ${isNew ? "" : "readonly"} pattern="[a-z0-9]+(-[a-z0-9]+)*" required></label>
        <label>Description<input name="note" value="${escapeHtml(app.note)}"></label>
        <label>Local URL<input name="localUrl" value="${escapeHtml(app.localUrl)}" placeholder="https://localhost:7456"></label>
        <label>Local key<input name="localKey" value="${escapeHtml(app.localKey)}" placeholder="dev"></label>
        <label>Local user<input name="localUser" value="${escapeHtml(app.localUser)}"></label>
        <label class="inline"><input type="checkbox" name="consumesBus" ${app.consumesBus ? "checked" : ""}> Consumes the bus (adds the local RabbitMQ)</label>
      </div>
      <h3>Projects</h3>
      <p class="muted">A project belongs to one app; picking one here moves it. Add new projects under Dependencies.</p>
      <div class="checks">${state.projects.map((project) => projectCheck(project, app)).join("")}</div>
      <h3>Start</h3>
      ${run.kind ? `<p class="muted">Started as <span class="chip">${escapeHtml(run.kind)}</span>; its start settings stay as they are.</p>` : runFields(app, run)}
      <div class="toolbar">
        <button type="submit">Save</button>
        <button type="button" class="secondary" id="cancel-app">Cancel</button>
      </div>
      <p id="app-form-message"></p>
    </form>`;

  byId("cancel-app").addEventListener("click", () => { byId("app-editor").innerHTML = ""; });
  byId("app-form").addEventListener("submit", (event) => saveApp(event, app));
  byId("app-form").scrollIntoView({ behavior: "smooth" });
}

function projectCheck(project, app) {
  const owner = project.app && project.app !== app.name ? ` <span class="muted">(now ${escapeHtml(project.app)})</span>` : "";

  return `<label class="inline mono"><input type="checkbox" name="projects" value="${escapeHtml(project.project)}" ${app.projects.includes(project.project) ? "checked" : ""}> ${escapeHtml(project.project)}${owner}</label>`;
}

function runFields(app, run) {
  const env = Object.entries(run.requiresEnv ?? {}).map(([name, value]) => `${name}=${value}`).join("\n");

  return `
    <label class="inline"><input type="checkbox" name="runnable" ${app.run ? "checked" : ""}> A stack can start it</label>
    <div class="form-grid">
      <label>Project it starts<input name="runProject" value="${escapeHtml(run.project)}" list="app-project-list"></label>
      <label>Launch profile<input name="launchProfile" value="${escapeHtml(run.launchProfile)}" placeholder="Development"></label>
      <label>Ready when the log shows<input name="readyLog" value="${escapeHtml(run.readyLog)}" placeholder="Bus started"></label>
      <label>Ready when this process runs<input name="readyProcess" value="${escapeHtml(run.readyProcess)}"></label>
      <label>Needed environment variables (NAME=value per line)<textarea name="requiresEnv" rows="2">${escapeHtml(env)}</textarea></label>
    </div>
    <datalist id="app-project-list">${state.projects.map((project) => `<option value="${escapeHtml(project.project)}">`).join("")}</datalist>`;
}

function requestOf(form, app) {
  const data = new FormData(form);
  const kindRun = app.run?.kind ? { project: app.run.project, launchProfile: app.run.launchProfile, readyLog: app.run.readyLog, readyProcess: app.run.readyProcess, requiresEnv: app.run.requiresEnv } : null;

  return {
    note: data.get("note"),
    localUrl: data.get("localUrl"),
    localKey: data.get("localKey"),
    localUser: data.get("localUser"),
    consumesBus: data.get("consumesBus") === "on",
    projects: data.getAll("projects"),
    run: kindRun ?? (data.get("runnable") === "on" ? runOf(data) : null),
  };
}

function runOf(data) {
  const requiresEnv = Object.fromEntries(String(data.get("requiresEnv") ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => line.split(/=(.*)/s).slice(0, 2)));

  return { project: data.get("runProject"), launchProfile: data.get("launchProfile"), readyLog: data.get("readyLog"), readyProcess: data.get("readyProcess"), requiresEnv };
}

async function saveApp(event, app) {
  event.preventDefault();

  const form = event.target;
  const name = String(new FormData(form).get("name")).trim();
  const button = form.querySelector("button[type=submit]");
  const message = byId("app-form-message");
  const done = await submitChange(button, message, () => api(`/config/apps/${encodeURIComponent(name)}`, "PUT", requestOf(form, app)), `${name} saved.`);

  if (done) {
    await renderApps(byId("apps"));
    showMessage(byId("apps-message"), done, false);
  }
}

async function deleteApp(button) {
  const name = button.dataset.deleteApp;

  if (!confirm(`Delete the app ${name} from services.json? Its projects stay in map.json.`)) {
    return;
  }

  const done = await submitChange(button, byId("apps-message"), () => api(`/config/apps/${encodeURIComponent(name)}`, "DELETE"), `${name} deleted.`);

  if (done) {
    await renderApps(byId("apps"));
    showMessage(byId("apps-message"), done, false);
  }
}
