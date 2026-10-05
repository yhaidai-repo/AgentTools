import type { ChatLauncher } from "../../models/ChatLauncher";
import type { ChatRequest } from "../../models/ChatRequest";

// The claude:// link cuts the prompt at about 14,000 characters (Claude docs, 2026-10-05).
const PROMPT_MAX = 14_000;

// Claude desktop's Code tab. Its link takes one folder and a prompt only, so the prompt asks the chat to add the repo
// folders itself.
export const claudeDesktopLauncher: ChatLauncher = {
  id: "claude-desktop",
  label: "Claude",
  open(request) {
    const prompt = claudePrompt(request);

    if (prompt.length > PROMPT_MAX) {
      return { ok: false, error: `The prompt has ${prompt.length} characters; a claude:// link takes about ${PROMPT_MAX}.` };
    }

    return { ok: true, value: { url: `claude://code/new?folder=${encodeURIComponent(request.folder)}&q=${encodeURIComponent(prompt)}` } };
  },
};

function claudePrompt(request: ChatRequest): string {
  const addRepos = request.repoFolders.length > 0 ? [`Add these repo folders to this session: ${request.repoFolders.join(", ")}.`] : [];
  const steps = [...addRepos, ...request.steps].map((step, index) => `${index + 1}. ${step}`);

  return [request.title, ...request.intro, ...steps].join("\n");
}
