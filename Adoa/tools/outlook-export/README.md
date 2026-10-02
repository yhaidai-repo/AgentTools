# Outlook exporter

Feeds adoa's `outlook` import source: new **Inbox** mails whose subject matches (default `Backlog Refinement`,
`Sprint Planning`) are written as JSON files into `import-inbox/outlook`. adoa's `pbi-import` job syncs the PBIs they
link and prepares the new ones for refinement. Design: `adoa-mail-import` in the personal docs vault.

- Needs **classic Outlook**, running. The new Outlook can't be scripted. Closed Outlook = nothing exported (logged).
- Read only: mails are never marked, moved or answered. Nothing leaves the PC.
- Only mails from the last 14 days (`-LookbackDays`), at most 50 per run (`-MaxPerRun`); `state.json` remembers what was
  exported. `export.log` holds one line per run.

## Run once
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Export-AdoaMail.ps1 -Subjects "Backlog Refinement"
```
Use `powershell.exe` (Windows PowerShell 5.1); PowerShell 7 can't attach to a running Outlook.

## Every 15 minutes (Task Scheduler, as you, no admin)
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Register-AdoaMailTask.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Register-AdoaMailTask.ps1 -Unregister
```
Options: `-IntervalMinutes`, `-Subjects`, `-OutputPath` (when `IMPORT_INBOX_PATH` isn't `./import-inbox`).

## Notes
- If Outlook runs as administrator and the task doesn't (or the other way round), the script can't attach to it.
- Outlook may ask "A program is trying to access e-mail address information" when its antivirus status is unknown.
- Outlook busy (starting, syncing, a dialog open) rejects calls: the script tries 3 times, 10 s apart, then waits for the next run.
