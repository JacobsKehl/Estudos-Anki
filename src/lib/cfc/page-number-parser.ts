/**
 * Parser de números de página do sumário do CFC.
 * Trata quebras de números de página separados por espaço no fim da linha (ex: "1 12" -> 112, "1 18" -> 118).
 */

export function parseSummaryLinePageNumber(lineText: string): { title: string; pageNumber: number | null } {
  const cleanLine = lineText.trim();
  const match = cleanLine.match(/^(.*?)(?:\.|\s){2,}\s*(\d[\d\s]*)$/);
  if (!match) {
    return { title: cleanLine, pageNumber: null };
  }

  const rawTitle = match[1].replace(/\.+$|\s+$/g, "").trim();
  const rawPageStr = match[2];

  // Remove espaços do número de página capturado (ex: "1 12" -> "112")
  const pageNumber = parseInt(rawPageStr.replace(/\s+/g, ""), 10);

  return { title: rawTitle, pageNumber };
}
