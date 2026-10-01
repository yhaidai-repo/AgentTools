import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { getAgentConfig } from "@/lib/agentConfig";
import { contentHash, loadRevisions, loadSkillFile } from "@/lib/skillEditing";
import { skillFolders } from "@/lib/skills";
import { RestoreButton } from "./RestoreButton";
import { SkillEditor } from "./SkillEditor";

export const dynamic = "force-dynamic";

// One existing skill: where it lives, which agents use it, its SKILL.md to edit, and the versions saves replaced.
export default async function SkillPage({ params, searchParams }: { params: Promise<{ name: string }>; searchParams: Promise<{ agent?: string }> }) {
  const { name } = await params;
  const { agent: fromAgent } = await searchParams;
  const skill = await loadSkillFile(decodeURIComponent(name));

  if (!skill) {
    notFound();
  }

  const folder = skillFolders().find((entry) => entry.path === skill.folder);
  const hostPath = folder?.hostPath ?? skill.folder;
  const isEditable = folder?.editable ?? false;
  const usedBy = (await getAgentConfig().list()).filter((agent) => agent.skills.includes(skill.name)).map((agent) => agent.label);
  const hash = contentHash(skill.content);
  const revisions = await loadRevisions(skill.name);

  return (
    <>
      <h1>Skill: {skill.name}</h1>
      <p>{fromAgent ? <Link href={`/agents/${fromAgent}/config`}>← {fromAgent} config</Link> : <Link href="/agents">← Agents</Link>}</p>
      <div className="chips">
        <span className="chip">folder: {hostPath}</span>
        <span className="chip">used by: {usedBy.length > 0 ? usedBy.join(", ") : "no agent (PBIs may add it)"}</span>
      </div>
      {isEditable ? <Editable name={skill.name} content={skill.content} hash={hash} /> : <ViewOnly content={skill.content} />}
      <h2>Earlier versions</h2>
      {revisions.length === 0 ? <p className="muted">None yet.</p> : (
        <ul>
          {revisions.map((revision) => (
            <li key={revision.id}>
              <details>
                <summary>Replaced <LocalTime date={revision.savedAt} /></summary>
                <pre>{revision.content}</pre>
                {isEditable && <RestoreButton name={skill.name} revisionId={revision.id} hash={hash} />}
              </details>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Editable({ name, content, hash }: { name: string; content: string; hash: string }) {
  return (
    <>
      <p className="muted">Edits apply to every agent and PBI that loads this skill, from their next run. The previous version is kept below.</p>
      <SkillEditor name={name} content={content} hash={hash} />
    </>
  );
}

// Not one of adoa's own skills (e.g. a personal Claude Code skill): adoa only shows it.
function ViewOnly({ content }: { content: string }) {
  return (
    <>
      <p className="muted">View only: adoa edits only its own skills (Adoa/skills). Edit this one where it lives.</p>
      <pre>{content}</pre>
    </>
  );
}
