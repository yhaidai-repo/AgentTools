import { MarkdownText } from "@/components/MarkdownText";
import { loadHandoffSection } from "@/lib/handoffs";

// What a task was handed (user report 2026-10-29: a review task's steps said "the hand-off above", but the page showed
// only the task's own fields): the sender's package with its references, so the reviewer can open what it asks about.
export async function HandoffSection({ item }: { item: { id: string; data: unknown } }) {
  const text = await loadHandoffSection(item);

  if (!text) {
    return null;
  }

  return (
    <>
      <h2>Hand-off</h2>
      <MarkdownText text={text} />
    </>
  );
}
