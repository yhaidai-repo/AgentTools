# PowerLoom — Clearer demos, fewer blocked runs

2026-10-30

- Added smooth zooms that keep demonstration controls and results readable.
- Kept the cursor aligned with zoomed views and click feedback after camera movement.
- Preserved private-value masks throughout GIF transitions.
- Fixed saved workflow images being reported as unknown or omitted from guide packages.
- Corrected blank-browser guidance so agents navigate before asking for sign-in access.
- Enabled skills to load their linked guidelines and page templates.
- Recovered interrupted Codex usage when complete accounting evidence is available.
- Explained incomplete costs and added audited provisional budget reservations.

Code: [AgentTools on GitHub — main](https://github.com/yhaidai-repo/AgentTools/tree/main).

From the repository's deployment checkout:

```powershell
git pull --ff-only origin main
pwsh -NoProfile -File ./PowerLoom/scripts/deploy-web.ps1 -WithApi -WithRunner
```
