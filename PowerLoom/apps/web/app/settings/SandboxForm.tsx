"use client";

import { useActionState } from "react";
import { KeptForm } from "@/components/KeptForm";
import { ResultLine } from "@/components/ResultLine";
import { SettingsHead } from "@/components/SettingsHead";
import type { SandboxSetting } from "@/lib/sandboxSettings";
import type { ActionResult } from "@/models/ActionResult";
import type { SandboxImageOption } from "@/models/SandboxImageOption";
import { saveSandboxAction } from "./actions";

// Settings → Data access → Sandbox (design agent-sandbox, phase 3b): the hosts this vault's package restores may reach
// and the image its sandboxes start from. Which agents get a sandbox is each agent's own switch.
export function SandboxForm({ setting, images }: { setting: SandboxSetting | null; images: SandboxImageOption[] }) {
  const [result, action, isSaving] = useActionState<ActionResult | null, FormData>(saveSandboxAction, null);

  if (!setting) {
    return <p className="hint text-warn">Sandbox: unknown, PowerLoom isn't reachable.</p>;
  }

  const hosts = setting.packageHosts ?? [];
  const image = setting.image ?? "";

  return (
    <KeptForm action={action} clearOn={result} className="panel settings-card">
      <SettingsHead title="Sandbox" description="Agents with the sandbox switched on run commands in an isolated container with no network. Only sandbox_restore goes out, to fetch the packages a repo declares, and only to the hosts listed here. This vault's own Azure DevOps feeds are added on their own, with its token." />
      <div className="settings-body">
        <div className="field-grid">
          <label className="field"><span>Package hosts<small>one per line; *.example.com for every host under it</small></span><textarea name="packageHosts" rows={5} defaultValue={hosts.join("\n")} /></label>
          <label className="field"><span>Image<small>{describe(images, image)}</small></span>
            <select name="image" defaultValue={image}>
              {images.map((image, index) => <option key={image.name} value={index === 0 ? "" : image.name}>{image.name}{index === 0 ? " (default)" : ""}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="settings-foot">
        <ResultLine result={result} />
        <button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save"}</button>
      </div>
    </KeptForm>
  );
}

function describe(images: SandboxImageOption[], name: string): string {
  const image = name ? images.find((option) => option.name === name) : images[0];

  return image?.description || "from the image catalog (sandbox-images.json)";
}
