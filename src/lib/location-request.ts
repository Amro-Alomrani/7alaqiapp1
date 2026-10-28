/** Bound the entire request, including a provider that never calls back. */
export function runLocationRequest<T>(request: () => Promise<T>, timeout: number, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: unknown, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value as T);
    };
    const abort = () => finish(Object.assign(new Error('Location request cancelled.'), { name: 'AbortError', code: 2 }));
    const timer = setTimeout(() => finish({ code: 3, message: 'Location request timed out.' }), timeout);
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
    try { request().then(value => finish(null, value), error => finish(error)); }
    catch (error) { finish(error); }
  });
}
