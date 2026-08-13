import { parseSummaryLinePageNumber } from "../../lib/cfc/page-number-parser";

describe("CFC Summary Page Number Parser", () => {
  it("deve parsear página de 3 dígitos quebrada com espaço '1 12' -> 112", () => {
    const res = parseSummaryLinePageNumber("Alienações .... 1 12");
    expect(res.title).toBe("Alienações");
    expect(res.pageNumber).toBe(112);
  });

  it("deve parsear página de 3 dígitos quebrada com espaço '1 18' -> 118", () => {
    const res = parseSummaryLinePageNumber("Garantia .... 1 18");
    expect(res.title).toBe("Garantia");
    expect(res.pageNumber).toBe(118);
  });

  it("deve parsear página de 1 dígito sem quebra '3'", () => {
    const res = parseSummaryLinePageNumber("Aspectos Introdutórios do Direito Constitucional .... 3");
    expect(res.title).toBe("Aspectos Introdutórios do Direito Constitucional");
    expect(res.pageNumber).toBe(3);
  });

  it("deve parsear página de 3 dígitos sem quebra '105'", () => {
    const res = parseSummaryLinePageNumber("Processo Administrativo Federal .... 105");
    expect(res.title).toBe("Processo Administrativo Federal");
    expect(res.pageNumber).toBe(105);
  });
});
