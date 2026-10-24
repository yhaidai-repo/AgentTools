const STOP_WORDS = new Set(["the", "and", "for", "are", "this", "that", "with", "from", "what", "which", "should", "does", "how", "not", "its", "their", "there", "into", "any"]);

// Word overlap (Jaccard) of two texts, 0..1: lower-case words of 3+ letters, without common stop words. Measured on real
// items (2026-10-01): reworded duplicates and different questions both score 0.2-0.35, verbatim repeats 1.0, so only
// near-identical text can be caught this way.
export function textSimilarity(a: string, b: string): number {
  const left = significantWords(a);
  const right = significantWords(b);
  const shared = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;

  return union === 0 ? 0 : shared / union;
}

function significantWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];

  return new Set(words.filter((word) => word.length > 2 && !STOP_WORDS.has(word)));
}
