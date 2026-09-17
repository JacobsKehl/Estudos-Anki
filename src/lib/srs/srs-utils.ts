/**
 * Normalizes text for semantic comparison.
 * Removes accents, lowercase, removes special chars, and trims.
 */
export function normalizeText(text: string) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
