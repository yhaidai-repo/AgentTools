# Audio capture

Records a meeting on this PC (your microphone and what you hear) and transcribes it locally, then hands the transcript to
PowerLoom's `meetings` import source as a JSON file. Design and measurements: `powerloom-audio-capture` in the personal
docs vault.

- **Local only.** Audio stays in the tool's home, `recordings\<stamp>-<slug>\` (`mic.wav`, `system.wav`, `meeting.json`,
  `transcript.md`, `transcript.json`). Only the transcript goes to PowerLoom.
- **Free speech recognition.** OpenAI Whisper weights (`large-v3-turbo` by default, `large-v3` optional) run through Whisper.net
  on the GPU (Vulkan; CUDA when its toolkit is installed; CPU as the last resort). Language is detected per window, so
  Ukrainian, Russian and English mixed in one meeting work; a prompt (`prompt.txt`) with your tech terms steers the spelling.
- Two channels give the speakers: `Me:` (mic) and `Them:` (system audio). A mic segment that repeats what the system channel
  said at the same moment (speakers, headset leakage) is dropped; silence hallucinations are filtered.

## Projects
| Project | Role |
|---|---|
| `PowerLoom.AudioCapture.Core` | recording, transcription, the resident process's logic (`RecorderDaemon`), control files, install |
| `PowerLoom.AudioCapture.Window` | the resident process you see: tray icon, conversation window (bubbles, level meters, Start/Stop) |
| `PowerLoom.AudioCapture` | the command line |

Both executables build into `bin\Release\` (one folder, so `install` finds the window app beside the CLI).

## Install (once)
```powershell
dotnet build PowerLoom.AudioCapture.Window -c Release
.\bin\Release\PowerLoom.AudioCapture.exe install --inbox D:\Projects\AgentTools\PowerLoom\import-inbox\meetings
```
Writes `settings.json` and `prompt.txt` into the tool's home (`%LOCALAPPDATA%\PowerLoom\audio-capture`, or `--home <path>`,
remembered in `home.txt` beside the exe), registers the Task Scheduler task **PowerLoom audio capture** (the resident `run`
process at logon, hidden, as you, no admin) and starts it. Options: `--model large-v3`, `--hotkey Ctrl+Alt+F9`.
Installing from a shell whose profile writes are virtualized (the Claude desktop app's sandbox) needs `--home` on a real
folder, e.g. `tools\audio-capture\home` (ignored by git).
The first transcription downloads the model (1.6 GB turbo, 3.1 GB large-v3) from Hugging Face into `models\`.

## Use
| Do | How |
|---|---|
| Start recording | hotkey (default `Ctrl+Alt+F9`), the window's **Start recording**, the tray menu, or `PowerLoom.AudioCapture.exe record start [--title "Sprint planning"]` |
| Stop | the same again; transcription runs right after, the inbox file appears in seconds to a minute |
| See the conversation | double-click the tray icon (grey dot; red while recording) or start `PowerLoom.AudioCapture.Window.exe`: bubbles per turn (Me right, Them left), level meters, clock, Open folder; the last session shows at start |
| See what it does | `status`; `audio-capture.log` has one line per event |
| Stop the resident process | tray **Quit** or `quit` (also needed before `dotnet build`: the exe is locked while it runs) |
| Remove | `uninstall` (settings, models and recordings stay) |

Closing the window hides it; the process stays for the hotkey and the CLI.

While recording, the window streams: each channel is cut at pauses (0.7 s of silence after at least 0.8 s of speech, or
15 s), every chunk is transcribed at once and shown as a dimmed, italic bubble a few seconds behind the speech. After Stop
the final pass replaces them. The window follows Windows' app mode (dark or light); `install --theme dark|light|system`.

## Speakers
- **Live**: every chunk of the others' channel gets a voice print (WeSpeaker ResNet34 embeddings, CPU, offline). A print
  close to a stored profile shows that name at once; one close to a voice already heard in this meeting joins it; any
  other starts `Speaker 1`, `Speaker 2`, … in order of first appearance. The boxes above the bubbles appear as voices
  are heard. One Start before the meeting, one Stop after; nothing else to press.
- **Naming**: type a name into a voice's box and press Enter, during the meeting or after (or
  `speakers <folder> --rename "Speaker 2=Anna"`). The bubbles, `speakers.json`, the transcript and the inbox file (while it
  still waits) take the name, and the voice print goes into `voices.json` in the home. From then on that voice is named
  in later meetings, live. Giving a voice a name another voice already has merges the two.
- **Fewer false voices**: a stretch shorter than 4 s never opens a new voice, it joins the closest one; every 20 stretches
  voices that have drifted close are merged (a named voice absorbs an unnamed one). Voices under 3 s are not boxed, only
  counted ("+n under 3 s"). Each sentence of a stretch is labelled by its own print, so a speaker change inside a stretch
  lands on the right voice.
- **Moving a bubble**: right-click a bubble of the others and pick the right voice, or a new name. Live it changes the
  recording's transcript; after Stop it rewrites the files, and when the bubble is 3 s or longer the chosen voice learns
  from its audio.
- **At Stop** the live transcript is saved as it is and handed to PowerLoom in about a second; there is no second pass
  (user, 2026-10-14). `transcribe <folder>` still re-runs recognition and diarization on a session by hand.
- *Not used at Stop any more:* the channel can be diarized properly (pyannote segmentation 3.0 + the same embeddings; the two models, 33 MB,
  download on first use into `models\`); the clusters take the live labels and names, so what you saw stays. A one-hour
  meeting takes a few minutes in the background.
- Prints compare in a **voice space** (`voice-space.json`): the mean of every print ever seen is subtracted first, which
  separates strangers (raw cosine crowded them together). Until eight prints are seen, matching is strict; it loosens
  as the space fills during the first meeting.
- Diarization can split one person into two voices (a short interjection) or merge two similar ones; name what is right,
  the stored prints improve the matching. The mic channel is always `Me`.

## Devices and languages
- `devices` lists microphones and outputs with their default roles. Without a setting the tool records the **default
  communications** devices, the ones Teams uses unless its own device settings say otherwise. `install --mic AirPods
  --system AirPods` names them by a part of their friendly name.
- A Bluetooth headset mic (AirPods) delivers a low, narrow-band signal; a wired or USB mic transcribes your own voice better.
- `--languages uk,ru,en` (default): a segment detected as another language is treated as noise. Silence hallucinations
  ("Дякую за перегляд!", "[музыка]") are filtered; Whisper only sees stretches with sound.
- `prompt.txt` in the home steers the spelling of terms: keep it a **list of terms**. A sentence in Ukrainian made a
  Russian speaker's chunks come out half Ukrainian.

Without `--title` the name comes from the Teams call window ("Weekly sync | Microsoft Teams"), else it is `meeting`.
The resident process starts itself on the first `record start` when the task isn't running.

## Inbox file
`<inbox>/<stamp>-<slug>.json` (written as `.json.tmp`, then renamed): `source` (`audio-capture`), `sourceRef`, `title`,
`startedAt`, `endedAt`, `durationSec`, `model`, `transcriptPath` (PC path), `transcript` (markdown, `[hh:mm:ss] Me|Them: …`),
`segmentCount`.

## Checks and re-runs
- `record-for 20 --title test`: a fixed-length recording without the resident process.
- `transcribe <folder> [--model large-v3] [--prompt-file …] [--with-context] [--runtime vulkan] [--inbox <path>]`: run the
  recognition again on a session folder, optionally re-sending it to the inbox.
- `download-model large-v3`.

## Notes
- Recording other people needs their consent where you are; the tool doesn't announce itself.
- WASAPI loopback stops delivering while nothing plays; the tool keeps a silent stream open so the timeline stays continuous.
- `--with-context` lets Whisper carry a window's text into the next one; off by default because `large-v3` then translated
  Russian speech into English after an English stretch.
