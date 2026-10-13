import { api, byId, escapeHtml, showMessage } from "./core.js";

// The local stack: what runs (phase, owner, apps, start output), start a chain of apps, stop it, read an app's log.
// A stack started here has no owner, so PowerLoom's runs leave it alone; the bridge stops it when its time is up.

const POLL_MS = 3000;
const LOG_REFRESH_MS = 5000;
const DEFAULT_TTL_MINUTES = 60;

let pollTimer = null;
let logTimer = null;

export async function renderStack(section) {
  stopTimers();

  const [status, apps] = await Promise.all([api("/stack"), api("/config/apps")]);

  section.innerHTML = `
    <div class="card" id="stack-status"></div>
    <div class="card">
      <h2>Start a stack</h2>
      <p class="muted">The apps run on this PC pointed at each other; every other dependency stays on Azure dev. A consumer adds the local RabbitMQ.</p>
      <form id="start-form">
        <div class="checks">${apps.filter((app) => app.run).map(appCheck).join("")}</div>
        <div class="form-grid">
          <label>Branch (its worktree per repo; empty = the main checkouts)<input name="branch" placeholder="feature/26885-Something"></label>
          <label>Stops by itself after (minutes)<input name="ttlMinutes" type="number" min="1" max="240" value="${DEFAULT_TTL_MINUTES}"></label>
        </div>
        <button type="submit">Start</button>
        <p id="start-message"></p>
      </form>
    </div>
    <div class="card">
      <h2>Logs</h2>
      <form id="log-form" class="toolbar">
        <select name="service"></select>
        <input name="lines" type="number" min="1" max="2000" value="200">
        <label class="inline"><input type="checkbox" name="error"> error log</label>
        <label class="inline"><input type="checkbox" name="follow"> refresh every 5 s</label>
        <button type="submit" class="small">Show</button>
      </form>
      <pre id="log-output" class="log"></pre>
    </div>`;

  byId("start-form").addEventListener("submit", startStack);
  byId("log-form").addEventListener("submit", (event) => { event.preventDefault(); showLog(); });
  byId("log-form").elements.follow.addEventListener("change", followLog);
  drawStatus(status);
}

function appCheck(app) {
  const note = app.consumesBus ? " (bus)" : "";

  return `<label class="inline"><input type="checkbox" name="services" value="${escapeHtml(app.name)}"> <strong>${escapeHtml(app.name)}</strong> <span class="muted">${escapeHtml(app.note)}${note}</span></label>`;
}

function drawStatus(status) {
  const target = byId("stack-status");

  if (!target) {
    return;
  }

  target.innerHTML = `
    <div class="toolbar">
      <h2>Stack: ${phaseText(status)}</h2>
      ${status.running || status.phase === "starting" ? `<button id="stop-stack" class="small secondary">Stop</button>` : ""}
    </div>
    <p class="muted">${statusLine(status)}</p>
    ${status.services.length === 0 ? "" : serviceTable(status.services)}
    ${status.output.length === 0 ? "" : `<details ${status.phase === "failed" ? "open" : ""}><summary>Start output (${status.output.length} lines)</summary><pre class="log">${escapeHtml(status.output.join("\n"))}</pre></details>`}
    <p id="stop-message"></p>`;

  byId("stop-stack")?.addEventListener("click", () => stopStack(status));
  fillLogServices(status.services);
  pollWhileStarting(status);
}

function phaseText(status) {
  const css = { ready: "ok", failed: "error", starting: "warning", stopping: "warning" }[status.phase] ?? "muted";

  return `<span class="${css}">${escapeHtml(status.running && status.phase === "idle" ? "running (not started here)" : status.phase)}</span>`;
}

function statusLine(status) {
  const owner = status.owner ? `started by ${escapeHtml(status.owner)}` : status.phase === "idle" ? "" : "started here or by hand";
  const parts = [owner, status.branch ? `branch ${escapeHtml(status.branch)}` : "", status.expiresAt ? `stops by itself at ${new Date(status.expiresAt).toLocaleTimeString()}` : ""];

  return parts.filter(Boolean).join(" · ") || "Nothing runs.";
}

function serviceTable(services) {
  const rows = services.map((service) => `
    <tr>
      <td><strong>${escapeHtml(service.name)}</strong></td>
      <td class="${service.running ? "ok" : "error"}">${service.running ? "running" : "stopped"}</td>
      <td>${service.url ? `<a href="${escapeHtml(service.url)}" target="_blank" rel="noreferrer" class="mono">${escapeHtml(service.url)}</a>` : ""}</td>
    </tr>`).join("");

  return `<table><thead><tr><th>App</th><th>State</th><th>URL</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// While the stack starts, the page asks again until it is ready or failed (and stops asking when the tab is left).
function pollWhileStarting(status) {
  clearTimeout(pollTimer);

  if (status.phase !== "starting" && status.phase !== "stopping") {
    return;
  }

  pollTimer = setTimeout(refreshStatus, POLL_MS);
}

async function refreshStatus() {
  if (byId("stack")?.hidden !== false) {
    return;
  }

  drawStatus(await api("/stack"));
}

async function startStack(event) {
  event.preventDefault();

  const data = new FormData(event.target);
  const request = { services: data.getAll("services"), branch: String(data.get("branch") ?? "").trim() || null, ttlMinutes: Number(data.get("ttlMinutes")) || DEFAULT_TTL_MINUTES };

  if (request.services.length === 0) {
    showMessage(byId("start-message"), "Tick at least one app.", true);
    return;
  }

  try {
    await api("/stack", "POST", request);
    showMessage(byId("start-message"), `Starting ${request.services.join(", ")}…`, false);
    await refreshStatus();
  } catch (error) {
    showMessage(byId("start-message"), error.message, true);
  }
}

async function stopStack(status) {
  const isRun = status.owner?.startsWith("powerloom-run-");
  const question = isRun ? `${status.owner} started this stack; its run may still use it. Stop it anyway?` : "Stop the local stack?";

  if (!confirm(question)) {
    return;
  }

  showMessage(byId("stop-message"), "Stopping…", false);

  try {
    await api("/stack", "DELETE");
    drawStatus(await api("/stack"));
  } catch (error) {
    showMessage(byId("stop-message"), error.message, true);
  }
}

// --- Logs ---

function fillLogServices(services) {
  const select = byId("log-form")?.elements.service;

  if (!select) {
    return;
  }

  const current = select.value;
  const withLog = services.filter((service) => service.log);

  select.innerHTML = withLog.map((service) => `<option ${service.name === current ? "selected" : ""}>${escapeHtml(service.name)}</option>`).join("") || `<option value="">no app with a log</option>`;
}

async function showLog() {
  const form = byId("log-form");
  const service = form?.elements.service.value;

  if (!service) {
    return;
  }

  const query = `lines=${Number(form.elements.lines.value) || 200}&error=${form.elements.error.checked}`;

  try {
    const log = await api(`/stack/logs/${encodeURIComponent(service)}?${query}`);
    byId("log-output").textContent = log.lines.join("\n") || "(empty)";
  } catch (error) {
    byId("log-output").textContent = error.message;
  }
}

function followLog(event) {
  clearInterval(logTimer);

  if (!event.target.checked) {
    return;
  }

  showLog();
  logTimer = setInterval(() => {
    if (byId("stack")?.hidden !== false) {
      clearInterval(logTimer);
      return;
    }

    showLog();
  }, LOG_REFRESH_MS);
}

function stopTimers() {
  clearTimeout(pollTimer);
  clearInterval(logTimer);
}
