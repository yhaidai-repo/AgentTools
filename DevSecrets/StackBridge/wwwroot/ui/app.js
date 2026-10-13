"use strict";

// The DevSecrets configuration, read-only: apps (services.json), who calls whom and every project's settings (map.json),
// the named values (values.*.json, masked; Show / Copy on request) and what the scripts would refuse.

const TOKEN_KEY = "devsecrets-bridge-token";
const TABS = ["apps", "dependencies", "secrets", "problems"];
const loaders = { apps: renderApps, dependencies: renderDependencies, secrets: renderSecrets, problems: renderProblems };

const byId = (id) => document.getElementById(id);

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function token() {
  return sessionStorage.getItem(TOKEN_KEY);
}

async function api(path) {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token()}` } });

  if (response.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    showTokenForm("The bridge refused the token.");
    throw new Error("unauthorized");
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new Error(problem.detail ?? `${response.status} ${response.statusText}`);
  }

  return response.json();
}

function showTokenForm(message) {
  byId("token-form").hidden = false;
  byId("tabs").hidden = true;
  byId("sign-out").hidden = true;
  TABS.forEach((tab) => { byId(tab).hidden = true; });
  byId("token-error").hidden = !message;
  byId("token-error").textContent = message ?? "";
}

async function openTab(tab) {
  byId("token-form").hidden = true;
  byId("tabs").hidden = false;
  byId("sign-out").hidden = false;
  TABS.forEach((name) => { byId(name).hidden = name !== tab; });
  document.querySelectorAll("nav button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  location.hash = tab;

  const section = byId(tab);
  section.innerHTML = `<p class="muted">Loading…</p>`;

  try {
    await loaders[tab](section);
  } catch (error) {
    if (error.message !== "unauthorized") {
      section.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
    }
  }
}

// --- Apps ---

async function renderApps(section) {
  const apps = await api("/config/apps");
  const rows = apps.map((app) => `
    <tr>
      <td><strong>${escapeHtml(app.name)}</strong><div class="muted">${escapeHtml(app.note)}</div></td>
      <td class="mono">${escapeHtml(app.localUrl ?? "—")}${app.localKey ? `<div class="muted">key ${escapeHtml(app.localKey)}</div>` : ""}</td>
      <td>${runText(app.run)}</td>
      <td>${readyText(app)}</td>
      <td>${app.consumesBus ? `<span class="chip">local RabbitMQ</span>` : ""}</td>
      <td>${app.projects.map((project) => `<div class="mono">${escapeHtml(project)}</div>`).join("") || `<span class="muted">none</span>`}</td>
    </tr>`).join("");

  section.innerHTML = `
    <div class="card">
      <p class="muted">${apps.length} apps from <code>services.json</code>. A stack starts each app's run project; its projects get their settings from <code>map.json</code>.</p>
      <table>
        <thead><tr><th>App</th><th>Local URL</th><th>Starts</th><th>Ready when</th><th>Bus</th><th>Projects</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function runText(run) {
  if (!run) {
    return `<span class="muted">not runnable</span>`;
  }

  if (run.kind) {
    return `<span class="chip">${escapeHtml(run.kind)}</span>`;
  }

  const env = Object.entries(run.requiresEnv ?? {}).map(([name, value]) => `<div class="muted">needs ${escapeHtml(name)}=${escapeHtml(value)}</div>`).join("");

  return `<div class="mono">${escapeHtml(shortProject(run.project))}</div><div class="muted">profile ${escapeHtml(run.launchProfile)}</div>${env}`;
}

function readyText(app) {
  const run = app.run;

  if (!run) {
    return "";
  }

  const conditions = [run.readyLog ? `log shows “${run.readyLog}”` : null, !run.readyLog && app.localUrl ? "URL answers" : null, run.readyProcess ? `process ${run.readyProcess} runs` : null];

  return conditions.filter(Boolean).map(escapeHtml).join("<br>");
}

function shortProject(project) {
  return (project ?? "").split("/").pop();
}

// --- Dependencies ---

async function renderDependencies(section) {
  const view = await api("/config/dependencies");
  const calls = view.apps.map((app) => `
    <div><strong>${escapeHtml(app.app)}</strong> calls</div>
    <div>${app.calls.map((call) => `<span class="chip ref" title="${escapeHtml(call.keys.join("\n"))}">${escapeHtml(call.service)}</span>`).join("")}</div>`).join("");

  section.innerHTML = `
    <div class="card">
      <h2>Who calls whom</h2>
      <p class="muted">A call goes to localhost while the called app runs in the same stack, otherwise to Azure dev. Hover a chip for the settings that carry it.</p>
      <div class="calls">${calls}</div>
    </div>
    <div class="card">
      <div class="toolbar"><h2>Project settings</h2><input id="project-filter" placeholder="Filter by project, key or value"></div>
      <div id="project-list"></div>
    </div>`;

  const filter = byId("project-filter");
  const draw = () => drawProjects(view.projects, filter.value.trim().toLowerCase());

  filter.addEventListener("input", draw);
  draw();
}

function drawProjects(projects, filter) {
  const visible = projects.filter((project) => !filter || JSON.stringify(project).toLowerCase().includes(filter));

  byId("project-list").innerHTML = visible.map((project) => `
    <details ${filter ? "open" : ""}>
      <summary><h3 class="mono">${escapeHtml(project.project)}</h3> <span class="muted">${escapeHtml(project.app ?? "no app")} · ${project.settings.length} settings</span></summary>
      <table>
        <thead><tr><th>Key</th><th>Source</th></tr></thead>
        <tbody>${project.settings.map(settingRow).join("")}</tbody>
      </table>
    </details>`).join("") || `<p class="muted">No project matches.</p>`;
}

function settingRow(setting) {
  return `<tr><td class="mono">${escapeHtml(setting.key)}</td><td>${settingSource(setting)}</td></tr>`;
}

function settingSource(setting) {
  if (!setting.service) {
    return `<span class="chip">${escapeHtml(setting.valueName)}</span>`;
  }

  const remote = setting.remoteValue ? ` <span class="muted">else</span> <span class="chip">${escapeHtml(setting.remoteValue)}</span>` : ` <span class="muted">always local</span>`;

  return `<span class="chip local">${escapeHtml(setting.service)} ${escapeHtml(setting.part)}</span>${remote}`;
}

// --- Secrets ---

async function renderSecrets(section) {
  const files = await api("/config/secrets");

  section.innerHTML = `
    <div class="toolbar"><input id="secret-filter" placeholder="Filter by name or project"></div>
    <div id="secret-files"></div>`;

  const filter = byId("secret-filter");
  const draw = () => drawSecretFiles(files, filter.value.trim().toLowerCase());

  filter.addEventListener("input", draw);
  draw();
}

function drawSecretFiles(files, filter) {
  byId("secret-files").innerHTML = files.map((file) => {
    const secrets = file.secrets.filter((secret) => !filter || JSON.stringify(secret).toLowerCase().includes(filter));

    return `
      <div class="card">
        <h2>values.${escapeHtml(file.file)}.json ${file.extends ? `<span class="muted">overrides values.${escapeHtml(file.extends)}.json</span>` : ""}</h2>
        ${secrets.length === 0 ? `<p class="muted">No values${filter ? " match" : ""}.</p>` : secretTable(secrets)}
      </div>`;
  }).join("");

  document.querySelectorAll("[data-show]").forEach((button) => button.addEventListener("click", () => showSecret(button)));
  document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", () => copySecret(button)));
}

function secretTable(secrets) {
  const rows = secrets.map((secret) => `
    <tr>
      <td class="mono">${escapeHtml(secret.name)}</td>
      <td>${secretState(secret)}<div class="secret-value mono" id="value-${escapeHtml(secret.file)}-${escapeHtml(secret.name)}"></div></td>
      <td>${secret.usedBy.length === 0 ? `<span class="warning">unused</span>` : `<details><summary>${secret.usedBy.length} setting(s)</summary>${secret.usedBy.map((use) => `<div class="mono muted">${escapeHtml(use)}</div>`).join("")}</details>`}</td>
      <td>
        <button class="small secondary" data-show="${escapeHtml(secret.file)}|${escapeHtml(secret.name)}">Show</button>
        <button class="small secondary" data-copy="${escapeHtml(secret.file)}|${escapeHtml(secret.name)}">Copy</button>
      </td>
    </tr>`).join("");

  return `<table><thead><tr><th>Name</th><th>Value</th><th>Used by</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
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

// --- Problems ---

async function renderProblems(section) {
  section.innerHTML = `<p class="muted">Checking with Use-DevSecrets.ps1 -Check…</p>`;

  const problems = await api("/config/problems");
  const errors = problems.filter((problem) => problem.level === "error");

  updateProblemCount(errors.length);

  section.innerHTML = problems.length === 0
    ? `<div class="card"><p class="ok">No problems: every project resolves with every values file.</p></div>`
    : `<div class="card"><table><thead><tr><th>Level</th><th>Where</th><th>Problem</th></tr></thead><tbody>${problems.map(problemRow).join("")}</tbody></table></div>`;
}

function problemRow(problem) {
  return `<tr><td class="${problem.level}">${escapeHtml(problem.level)}</td><td class="mono">${escapeHtml(problem.source)}</td><td>${escapeHtml(problem.message)}</td></tr>`;
}

function updateProblemCount(count) {
  byId("problem-count").hidden = count === 0;
  byId("problem-count").textContent = String(count);
}

// --- Start ---

byId("token-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  sessionStorage.setItem(TOKEN_KEY, byId("token").value.trim());
  byId("token").value = "";
  await openTab(TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "apps");
});

byId("sign-out").addEventListener("click", () => {
  sessionStorage.removeItem(TOKEN_KEY);
  showTokenForm();
});

document.querySelectorAll("nav button").forEach((button) => button.addEventListener("click", () => openTab(button.dataset.tab)));

if (token()) {
  openTab(TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "apps");
} else {
  showTokenForm();
}
