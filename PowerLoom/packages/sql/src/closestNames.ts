import { bareName } from "./queryTables";

const MAX_CLOSEST = 3;
const MIN_CONTAINED = 4;

// The candidates whose last part is close enough to be the name the agent meant: the same but for case and
// underscores, one inside the other (Status in VerificationStatus), or a few edits apart (Facilities for Facility).
// Candidates are as the hint shows them (dbo.Facility.FacilityId); the closest come first.
export function closestNames(wanted: string, candidates: string[]): string[] {
  const target = comparable(bareName(wanted));
  const scored = candidates.map((candidate) => ({ candidate, score: closeness(target, comparable(bareName(candidate))) }));
  const close = scored.filter((entry) => entry.score !== undefined) as { candidate: string; score: number }[];
  const ordered = close.sort((left, right) => left.score - right.score).map((entry) => entry.candidate);

  return ordered.filter((candidate, index) => ordered.indexOf(candidate) === index).slice(0, MAX_CLOSEST);
}

function closeness(target: string, candidate: string): number | undefined {
  if (target === candidate) {
    return 0;
  }

  if (isContained(target, candidate)) {
    return 1;
  }

  const distance = editDistance(target, candidate);

  return distance <= allowedEdits(target) ? distance : undefined;
}

function isContained(left: string, right: string): boolean {
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];

  return shorter.length >= MIN_CONTAINED && longer.includes(shorter);
}

// A short name allows one edit, so Id doesn't match every two-letter column.
function allowedEdits(name: string): number {
  return name.length <= 4 ? 1 : Math.max(2, Math.floor(name.length / 3));
}

function comparable(name: string): string {
  return name.toLowerCase().replace(/_/g, "");
}

// Levenshtein distance, one row at a time.
export function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let row = 1; row <= left.length; row++) {
    previous = nextRow(previous, left[row - 1], right, row);
  }

  return previous[right.length];
}

function nextRow(previous: number[], letter: string, right: string, row: number): number[] {
  const current = [row];

  for (let column = 1; column <= right.length; column++) {
    const substitution = previous[column - 1] + (letter === right[column - 1] ? 0 : 1);
    current.push(Math.min(previous[column] + 1, current[column - 1] + 1, substitution));
  }

  return current;
}
