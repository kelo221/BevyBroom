/** Interval between two checks while waiting for a condition. */
const DESKTOP_E2E_CHECK_MILLISECONDS = 250;

/**
 * Checks a condition again and again until it yields a value.
 *
 * @param description What is waited for, used in the timeout error.
 * @param check Returns the awaited value, or null while it is not there yet; a
 *   thrown error counts as not there yet.
 * @param timeoutMilliseconds Longest wait.
 * @returns The first value the check yielded.
 */
export async function desktopE2eWaitUntil<Value>(
  description: string,
  check: () => Promise<Value | null>,
  timeoutMilliseconds: number,
): Promise<Value> {
  const end = performance.now() + timeoutMilliseconds;
  let lastError = '';
  while (performance.now() < end) {
    const value = await check().catch((error: unknown) => {
      lastError = String(error);
      return null;
    });
    if (value !== null) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, DESKTOP_E2E_CHECK_MILLISECONDS));
  }
  throw new Error(`Timed out waiting for ${description}${lastError === '' ? '' : `; last error: ${lastError}`}`);
}
