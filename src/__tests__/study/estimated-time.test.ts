import { calculateEstimatedStudyMinutes } from "@/lib/study/estimated-time";

describe("estimated-time utility", () => {
  describe("calculateEstimatedStudyMinutes", () => {
    it("deve calcular o tempo estimado baseado no número de páginas", () => {
      const res = calculateEstimatedStudyMinutes({
        totalPages: 10,
        minutesPerPage: 3,
        minimumBlockMinutes: 10,
      });
      expect(res.estimatedMinutes).toBe(30);
      expect(res.calculationMethod).toBe("PAGES");
    });

    it("deve usar palavras quando fornecido totalWords", () => {
      const res = calculateEstimatedStudyMinutes({
        totalWords: 1500,
        wordsPerMinute: 150,
        minimumBlockMinutes: 5,
      });
      expect(res.estimatedMinutes).toBe(10);
      expect(res.calculationMethod).toBe("WORDS");
    });

    it("deve aplicar minimumBlockMinutes se o tempo for menor", () => {
      const res = calculateEstimatedStudyMinutes({
        totalPages: 1,
        minutesPerPage: 3,
        minimumBlockMinutes: 15,
      });
      expect(res.estimatedMinutes).toBe(15);
    });

    it("deve limitar ao teto de availableMinutes se fornecido", () => {
      const res = calculateEstimatedStudyMinutes({
        totalPages: 20,
        minutesPerPage: 3,
        availableMinutes: 45,
      });
      expect(res.estimatedMinutes).toBe(45);
    });
  });
});
