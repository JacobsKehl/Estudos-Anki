import {
  calculateEstimatedStudyMinutes,
  calculatePagesFromMinutes,
  DEFAULT_STUDY_TIME_CONFIG,
} from "@/lib/study/estimated-time";

describe("estimated-time utility", () => {
  describe("calculateEstimatedStudyMinutes", () => {
    it("deve calcular o tempo estimado baseado no número de páginas", () => {
      const minutes = calculateEstimatedStudyMinutes({
        totalPages: 10,
        minutesPerPage: 3,
      });
      expect(minutes).toBe(30);
    });

    it("deve usar palavras quando fornecido totalWords", () => {
      const minutes = calculateEstimatedStudyMinutes({
        totalWords: 1500,
        wordsPerMinute: 150,
      });
      expect(minutes).toBe(10);
    });

    it("deve aplicar minimumBlockMinutes se o tempo for menor", () => {
      const minutes = calculateEstimatedStudyMinutes({
        totalPages: 1,
        minutesPerPage: 3,
        minimumBlockMinutes: 15,
      });
      expect(minutes).toBe(15);
    });

    it("deve respeitar os valores padrões do DEFAULT_STUDY_TIME_CONFIG", () => {
      const minutes = calculateEstimatedStudyMinutes({
        totalPages: 5,
      });
      expect(minutes).toBe(5 * DEFAULT_STUDY_TIME_CONFIG.minutesPerPage);
    });
  });

  describe("calculatePagesFromMinutes", () => {
    it("deve calcular quantas páginas cabem no tempo disponível", () => {
      const pages = calculatePagesFromMinutes({
        availableMinutes: 30,
        minutesPerPage: 3,
      });
      expect(pages).toBe(10);
    });

    it("deve arredondar páginas para baixo se fractional=false", () => {
      const pages = calculatePagesFromMinutes({
        availableMinutes: 25,
        minutesPerPage: 3,
      });
      expect(pages).toBe(8);
    });
  });
});
