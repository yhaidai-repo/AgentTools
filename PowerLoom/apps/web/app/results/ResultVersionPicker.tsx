import Link from "next/link";
import { LinkPicker } from "@/components/LinkPicker";
import { versionKey } from "@/lib/resultLinks";
import type { ResultVersion } from "@/models/ResultVersion";

// The newest versions as pills, the rest in a dropdown (user decision 2026-10-21); each is a link, so only the chosen
// version is loaded.
const NEWEST_SHOWN = 3;

interface ResultVersionPickerProps {
  /** Oldest first. */
  versions: ResultVersion[];
  chosen: ResultVersion;
  hrefOf: (version: ResultVersion) => string;
}

export function ResultVersionPicker({ versions, chosen, hrefOf }: ResultVersionPickerProps) {
  if (versions.length < 2) {
    return null;
  }

  const newestFirst = [...versions].reverse();
  const older = newestFirst.slice(NEWEST_SHOWN);

  return (
    <div className="version-picker">
      <nav className="pill-switch mono" aria-label="Versions">
        {newestFirst.slice(0, NEWEST_SHOWN).map((version) => <VersionLink key={versionKey(version)} version={version} isChosen={versionKey(version) === versionKey(chosen)} href={hrefOf(version)} />)}
      </nav>
      {older.length > 0 && <LinkPicker label="Older versions" value={versionKey(chosen)} placeholder={`${older.length} older`} choices={older.map((version) => ({ key: versionKey(version), label: versionLabel(version), href: hrefOf(version) }))} />}
    </div>
  );
}

function VersionLink({ version, isChosen, href }: { version: ResultVersion; isChosen: boolean; href: string }) {
  return <Link href={href} scroll={false} replace className={isChosen ? "on" : undefined} title={versionLabel(version)}>{version.label}</Link>;
}

function versionLabel(version: ResultVersion): string {
  return version.runId === null ? version.label : `${version.label} · RUN-${version.runId}`;
}
