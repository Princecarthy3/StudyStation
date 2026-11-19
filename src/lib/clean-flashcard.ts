/**
 * Cleans flashcard back content, removing excessive meta-commentary such as
 * "Direct Answer:", "Connection to Source:", and "Additional General Knowledge (Labelled):".
 */
export function cleanFlashcardText(text: string | null | undefined): string {
  if (!text) return "";
  let cleaned = String(text).trim();

  // 1. If text contains "Direct Answer:", extract the text between "Direct Answer:" and any following section
  const directMatch = cleaned.match(
    /Direct Answer:\s*([\s\S]*?)(?=(?:\n\s*(?:Connection to Source|Additional General Knowledge|Source Citation|Note):|\s*(?:Connection to Source|Additional General Knowledge|Source Citation):|$))/i
  );
  if (directMatch && directMatch[1].trim()) {
    return directMatch[1].trim();
  }

  // 2. Strip out trailing "Connection to Source: ..." blocks
  cleaned = cleaned.replace(
    /(?:\n|\s)*(?:Connection to Source|Source Citation|Reference):\s*[\s\S]*?(?=(?:\n\s*Additional General Knowledge|$))/gi,
    ""
  );

  // 3. Strip out trailing "Additional General Knowledge (...): ..." blocks
  cleaned = cleaned.replace(
    /(?:\n|\s)*Additional General Knowledge(?:\s*\([^)]*\))?:\s*[\s\S]*$/gi,
    ""
  );

  // 4. Strip any leading "Direct Answer:" or "Answer:" label
  cleaned = cleaned.replace(/^(?:Direct Answer|Answer|Definition):\s*/i, "");

  return cleaned.trim() || text.trim();
}
