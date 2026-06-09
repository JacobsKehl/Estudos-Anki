/**
 * Helper to call Gemini API with robust retry policy (Exponential Backoff + Jitter)
 * to handle temporary 503 (Service Unavailable) and 429 (Rate Limit) errors.
 */
export async function callGeminiWithRetry<T>(
  apiCall: () => Promise<T>,
  maxAttempts: number = 5,
  baseDelayMs: number = 2000
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await apiCall();
    } catch (err: any) {
      lastError = err;
      const errMsg = err.message || "";
      const is503 = err.status === 503 || errMsg.includes("503") || errMsg.includes("Service Unavailable");
      const is429 = err.status === 429 || errMsg.includes("429") || errMsg.includes("Rate Limit") || errMsg.includes("Too Many Requests");
      const isTemporary = is503 || is429 || errMsg.includes("fetch failed");

      if (!isTemporary || attempt === maxAttempts) {
        console.error(`[Gemini Retry] Permanent or final attempt failure on attempt ${attempt}:`, errMsg || err);
        throw err;
      }

      // Se for limite de requisições (429), usamos um tempo de espera muito maior para liberar a janela de 1 minuto
      let delay = baseDelayMs * Math.pow(2, attempt - 1);
      if (is429) {
        // Multiplicador agressivo: tentativa 1 = 5s, 2 = 10s, 3 = 20s, 4 = 40s
        delay = 5000 * Math.pow(2, attempt - 1);
      }

      const jitter = Math.random() * 800;
      const finalDelay = delay + jitter;

      console.warn(
        `[Gemini Retry] Attempt ${attempt} failed with ${is503 ? "503 Service Unavailable" : is429 ? "429 Rate Limit (Too Many Requests)" : "temporary network error"}. ` +
        `Retrying in ${Math.round(finalDelay)}ms...`
      );

      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }

  throw lastError;
}
