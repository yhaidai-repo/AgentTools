import { renderApps } from "./apps.js";
import { TABS, byId, escapeHtml, forgetToken, saveToken, showTokenForm, token } from "./core.js";
import { renderDependencies } from "./dependencies.js";
import { renderProblems } from "./problems.js";
import { renderSecrets } from "./secrets.js";
import { renderStack } from "./stack.js";

// The DevSecrets configuration UI: apps (services.json), who calls whom and every project's settings (map.json), the
// named values (values.*.json), what the scripts would refuse, and the local stack. This file only switches tabs and holds
// the token.

const loaders = { apps: renderApps, dependencies: renderDependencies, secrets: renderSecrets, problems: renderProblems, stack: renderStack };

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

function tabFromHash() {
  const tab = location.hash.slice(1);

  return TABS.includes(tab) ? tab : "apps";
}

byId("token-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  saveToken(byId("token").value.trim());
  byId("token").value = "";
  await openTab(tabFromHash());
});

byId("sign-out").addEventListener("click", () => {
  forgetToken();
  showTokenForm();
});

document.querySelectorAll("nav button").forEach((button) => button.addEventListener("click", () => openTab(button.dataset.tab)));

if (token()) {
  openTab(tabFromHash());
} else {
  showTokenForm();
}
