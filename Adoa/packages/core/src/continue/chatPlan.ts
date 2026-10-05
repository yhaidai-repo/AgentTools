import type { ChatLauncher } from "../models/ChatLauncher";
import type { ChatPlan } from "../models/ChatPlan";
import type { ChatTarget } from "../models/ChatTarget";
import type { CommandContext } from "../models/CommandContext";
import type { ContinueEnv } from "../models/ContinueEnv";
import type { Outcome } from "../models/Outcome";
import { chatLauncher } from "./chatLaunchers";
import { itemChatPlan } from "./itemChat";
import { pbiChatPlan } from "./pbiChat";
import { reviewChatPlan } from "./reviewChat";

const MISSING_ENV = "Set VAULTS_ROOT and REPOS_ROOT in .env (the web gets them as CONTINUE_FOLDER and REPOS_ROOT).";

// The chat for a target in the configured agent app, before anything is prepared.
export async function chatPlan(context: CommandContext, target: ChatTarget): Promise<Outcome<{ plan: ChatPlan; launcher: ChatLauncher }>> {
  const env = context.continueEnv;
  const launcher = env ? chatLauncher(env.launcher) : null;

  if (!env || !launcher) {
    return { ok: false, error: env ? `Unknown chat launcher "${env.launcher}".` : MISSING_ENV };
  }

  const plan = await targetPlan(env, context, target);

  return plan.ok ? { ok: true, value: { plan: plan.value, launcher } } : plan;
}

function targetPlan(env: ContinueEnv, context: CommandContext, target: ChatTarget): Promise<Outcome<ChatPlan>> {
  switch (target.kind) {
    case "pbi":
      return pbiChatPlan(env, context, target.adoId);
    case "item":
      return itemChatPlan(env, context, target.itemId);
    case "review":
      return reviewChatPlan(env, context, target.prId);
  }
}

// For a page: the button's label, and why it's off (null when the chat can open). Nothing is prepared or changed.
export async function chatAvailability(context: CommandContext, target: ChatTarget): Promise<{ label: string; problem: string | null }> {
  const planned = await chatPlan(context, target);
  const label = chatLabel(context);

  if (!planned.ok) {
    return { label, problem: planned.error };
  }

  const launch = planned.value.launcher.open(planned.value.plan.request);

  return { label, problem: launch.ok ? null : launch.error };
}

// "Continue with <label>": the configured agent app's name.
export function chatLabel(context: CommandContext): string {
  const launcher = context.continueEnv ? chatLauncher(context.continueEnv.launcher) : null;

  return launcher?.label ?? "agent";
}
