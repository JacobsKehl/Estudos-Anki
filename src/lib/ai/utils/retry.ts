/**
 * Helper to call Gemini API with robust retry policy (Exponential Backoff + Jitter)
 * to handle temporary 503 (Service Unavailable) and 429 (Rate Limit) errors.
 */
export async function callGeminiWithRetry<T>(
  apiCall: () => Promise<T>,
  maxAttempts: number = 4,
  baseDelayMs: number = 1500
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await apiCall();
    } catch (err: any) {
      lastError = err;
      const is503 = err.status === 503 || (err.message && err.message.includes("503"));
      const is429 = err.status === 429 || (err.message && err.message.includes("429"));
      const isTemporary = is503 || is429 || err.message?.includes("fetch failed") || err.message?.includes("Service Unavailable");

      if (!isTemporary || attempt === maxAttempts) {
        console.error(`[Gemini Retry] Permanent or final attempt failure on attempt ${attempt}:`, err.message || err);
        throw err;
      }

      // Exponential backoff: delay = baseDelay * 2^(attempt-1) + jitter
      const jitter = Math.random() * 500;
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + jitter;

      console.warn(
        `[Gemini Retry] Attempt ${attempt} failed with ${is503 ? "503 Service Unavailable" : is429 ? "429 Rate Limit" : "temporary network error"}. ` +
        `Retrying in ${Math.round(delay)}ms...`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
