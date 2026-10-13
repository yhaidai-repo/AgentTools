import { api, byId, escapeHtml } from "./core.js";

// What a start would refuse (the scripts' check per values file) and loose ends worth a look.
export async function renderProblems(section) {
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
