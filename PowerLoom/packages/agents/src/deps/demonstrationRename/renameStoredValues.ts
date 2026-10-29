import { AGENT_ID, LEGACY_AGENT_ID, LEGACY_TOOL_SUMMARY, TOOL_SUMMARY } from "./legacyNames";
import { renameIdentifiers, renamePromptText } from "./renameIdentifiers";

type Json = Record<string, unknown>;
const TASK_TYPES = new Map([[LEGACY_AGENT_ID, AGENT_ID]]);
const SKILLS = new Map([["powerloom-support-guide", "powerloom-demonstration"]]);
const INTEGRATIONS = new Map([["writeSupportGuides", "writeDemonstrations"]]);

// An agent definition as an older version stored it, under the names the code uses now: the id, the skill, the task
// types it handles or may assign, the output switch, and the names a prompt edited in Settings requests.
export function renameStoredAgent(definition: Json): Json {
  const renamed = { ...definition };
  if (renamed.id === LEGACY_AGENT_ID) renamed.id = AGENT_ID;
  for (const field of ["handles", "canAssign", "skills"]) {
    if (field in renamed) renamed[field] = renameIdentifiers(renamed[field], field === "skills" ? SKILLS : TASK_TYPES);
  }
  if (Array.isArray(renamed.integrationSpecs)) {
    renamed.integrationSpecs = renamed.integrationSpecs.map(spec => isObject(spec) ? {
      ...spec, key: INTEGRATIONS.get(String(spec.key)) ?? spec.key,
      ...(spec.owner === LEGACY_AGENT_ID ? { owner: AGENT_ID } : {}),
    } : spec);
  }
  if (isObject(renamed.capabilities)) {
    renamed.capabilities = { ...renamed.capabilities, integrations: renameIdentifiers(renamed.capabilities.integrations, INTEGRATIONS) };
  }
  if (isObject(renamed.shipped)) {
    const shipped = { ...renamed.shipped };
    for (const field of ["handles", "canAssign", "skills"]) {
      if (field in shipped) shipped[field] = renameIdentifiers(shipped[field], field === "skills" ? SKILLS : TASK_TYPES);
    }
    renamed.shipped = shipped;
  }

  return typeof renamed.prompt === "string" ? { ...renamed, prompt: renamePromptText(renamed.prompt) } : renamed;
}

// What the Tools tab remembers an agent's last run was offered: the holder and the output tool by their new names.
export function renameToolOffer(offer: Json): Json {
  const renamed = { ...offer };
  if (renamed.holder === LEGACY_AGENT_ID) renamed.holder = AGENT_ID;

  if (!Array.isArray(renamed.tools)) {
    return renamed;
  }

  return { ...renamed, tools: renamed.tools.map(tool => isObject(tool) ? renameToolSummary({
    ...tool, ...(tool.name === "write_support_guide" ? { name: "write_demonstration" } : {}),
  }) : tool) };
}

function isObject(value: unknown): value is Json {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function renameToolSummary(tool: Json): Json {
  return tool.summary === LEGACY_TOOL_SUMMARY ? { ...tool, summary: TOOL_SUMMARY } : tool;
}
