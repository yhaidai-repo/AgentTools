import { Panel } from "@/components/Panel";
import { loadUserNotes } from "@/lib/userNotes";
import { UserNotesForm } from "./UserNotesForm";

// The `## Notes` section of the PBI's vault note: also editable in Obsidian, and the agents read it with the note.
export async function NotesTab({ adoId }: { adoId: number }) {
  const notes = await loadUserNotes(adoId);

  if (notes.text === null) {
    return <Panel><p className="empty">{notes.problem}</p></Panel>;
  }

  return (
    <Panel title="My notes" aside={<small>the PBI note&apos;s Notes section; refinement, research and planning read them</small>}>
      <UserNotesForm adoId={adoId} text={notes.text} />
    </Panel>
  );
}
