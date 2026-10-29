"use client";

import { useActionState } from "react";
import { ResultLine } from "@/components/ResultLine";
import type { ActionResult } from "@/models/ActionResult";
import type { PromptFile } from "@/models/PromptFile";
import { PromptField, type PromptVersion } from "../agents/[agent]/config/PromptField";
import { saveFrameworkAction } from "../agents/configActions";
import { ShippedNoteLine } from "../agents/[agent]/config/ShippedNoteLine";
import { KeptForm } from "@/components/KeptForm";

interface FrameworkFormProps {
  stored: string;
  storedVersion: number;
  file: PromptFile | null;
  versions: PromptVersion[];
  /** When an upgrade last put the shipped framework over an edited one. */
  replacedAt?: string;
}

// The shared framework, visible and editable like an agent's prompt (user decision 2026-10-25): every prompt with
// `{{framework}}` pulls it in on its next run. Keep it free of any one project; a vault's ENVIRONMENT.md holds those rules.
export function FrameworkForm({ stored, storedVersion, file, versions, replacedAt }: FrameworkFormProps) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveFrameworkAction, null);

  return (
    <KeptForm action={action}>
      <ShippedNoteLine note={replacedAt ? { fields: ["prompt"], at: replacedAt } : undefined} />
      <PromptField
        title="Shared framework"
        stored={stored}
        storedVersion={storedVersion}
        file={file}
        versions={versions}
        hint={<>Every agent prompt with <code>{"{{framework}}"}</code> gets this text there. Keep it project-neutral: a vault&apos;s <code>ENVIRONMENT.md</code> holds its environment&apos;s rules.</>}
      />
      <div className="settings-foot">
        <ResultLine result={result} />
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </KeptForm>
  );
}
