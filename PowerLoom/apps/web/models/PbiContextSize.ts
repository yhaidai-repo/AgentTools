// What the agents' context of a PBI weighs: in total and per part (the note, the user's notes, the references, …).
export interface PbiContextSize {
  chars: number;
  tokens: number;
  parts: { name: string; chars: number; tokens: number }[];
}
