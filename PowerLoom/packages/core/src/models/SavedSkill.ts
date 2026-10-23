// What PowerLoom answers to a skill save or restore: whether the file changed, and the revision a restore came from.
export interface SavedSkill {
  name: string;
  changed: boolean;
  restoredFrom: string | null;
}
