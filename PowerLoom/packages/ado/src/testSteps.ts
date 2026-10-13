import type { TestStep } from "./models/TestStep";

// <step …>…</step>, <compref … ref="123"> and </compref>, in document order. A compref (Shared Steps) holds the case's
// own steps that follow it, so its children are read as ordinary steps after it.
const TOKEN = /<step\b[^>]*>([\s\S]*?)<\/step>|<compref\b[^>]*\bref="(\d+)"[^>]*>/g;
const PARAMETERIZED = /<parameterizedString\b[^>]*>([\s\S]*?)<\/parameterizedString>|<parameterizedString\b[^>]*\/>/g;
const ENTITIES: Record<string, string> = { "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&apos;": "'", "&amp;": "&" };

// ADO's Microsoft.VSTS.TCM.Steps XML as a list of steps; the texts stay HTML (ADO stores them formatted).
export function parseTestSteps(xml: string | null | undefined): TestStep[] {
  return [...(xml ?? "").matchAll(TOKEN)].map((match) => (match[2] ? { kind: "shared", sharedStepsId: Number(match[2]) } : ownStep(match[1])));
}

function ownStep(body: string): TestStep {
  const [action = "", expected = ""] = [...body.matchAll(PARAMETERIZED)].map((match) => decodeXml(match[1] ?? ""));

  return { kind: "step", action, expected };
}

function decodeXml(text: string): string {
  return text.replace(/&(lt|gt|quot|apos|amp);/g, (entity) => ENTITIES[entity]);
}
