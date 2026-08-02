/** HTTP statuses that often succeed on a second try */
export const TRANSIENT_HTTP_STATUSES = new Set([
  408, // Request Timeout
  425, // Too Early
  429, // Too Many Requests
  500, // Internal Server Error (sometimes flaky)
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

export function isTransientHttpStatus(
  status: number | null | undefined,
): boolean {
  return status != null && TRANSIENT_HTTP_STATUSES.has(status);
}

/** Network / timeout class errors worth retrying */
export function isTransientError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) {
    // User-initiated abort is NOT transient for retry (caller must check signal)
    if (err.name === "AbortError") {
      return /timeout|timed out|aborted due to timeout/i.test(err.message);
    }
    const msg = `${err.name} ${err.message}`.toLowerCase();
    return (
      /timeout|timed out|etimedout|econnreset|econnrefused|econnaborted|epipe|enetunreach|ehostunreach|eai_again|enotfound|socket|network|fetch failed|failed to fetch|load failed|429|502|503|504|temporarily unavailable|try again/i.test(
        msg,
      )
    );
  }
  if (typeof err === "string") {
    return isTransientError(new Error(err));
  }
  return false;
}

export function computeBackoffMs(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitter = true,
): number {
  // attempt is 1-based after a failure → delay before next try
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  if (!jitter) return exp;
  const spread = exp * 0.2;
  return Math.round(exp - spread + Math.random() * spread * 2);
}

export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  if (signal?.aborted) {
    const e = new Error("Aborted");
    e.name = "AbortError";
    throw e;
  }
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      const e = new Error("Aborted");
      e.name = "AbortError";
      reject(e);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export type RetryOptions = {
  /** Total attempts including the first (default 3) */
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  shouldRetry?: (err: unknown, attempt: number) => boolean;
  onRetry?: (info: {
    attempt: number;
    nextAttempt: number;
    error: unknown;
    delayMs: number;
  }) => void;
};

/**
 * Run `fn` with exponential backoff on transient failures.
 * `fn` receives 1-based attempt number.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const baseDelayMs = opts.baseDelayMs ?? 200;
  const maxDelayMs = opts.maxDelayMs ?? 2_500;
  const shouldRetry = opts.shouldRetry ?? ((err) => isTransientError(err));

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (opts.signal?.aborted) {
      const e = new Error("Aborted");
      e.name = "AbortError";
      throw e;
    }
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const canRetry =
        attempt < maxAttempts &&
        !opts.signal?.aborted &&
        shouldRetry(err, attempt);
      if (!canRetry) throw err;
      const delayMs = computeBackoffMs(attempt, baseDelayMs, maxDelayMs);
      opts.onRetry?.({
        attempt,
        nextAttempt: attempt + 1,
        error: err,
        delayMs,
      });
      await sleep(delayMs, opts.signal);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "Retry failed"));
}

/**
 * Decide if a harvested HTTP status page should be retried.
 * Permanent client errors (404, 401, 403) are not retried.
 */
export function shouldRetryHttpStatus(status: number | null | undefined): boolean {
  return isTransientHttpStatus(status);
}
