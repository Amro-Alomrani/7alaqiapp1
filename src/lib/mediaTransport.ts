/** One bounded transfer; never retries a write whose result is uncertain. */
export async function transferImage(url: string, headers: Record<string, string>, image: Blob, fetchImpl: typeof fetch = fetch, timeoutMs = 60_000): Promise<{ bucket: string; path: string; url: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { method: 'POST', headers, body: image, signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error('Image upload failed.'), { code: payload?.error?.code || 'storage/request-failed', statusCode: String(response.status) });
    if (!payload || typeof payload.bucket !== 'string' || typeof payload.path !== 'string' || typeof payload.url !== 'string') {
      throw Object.assign(new Error('Invalid uploaded image reference.'), { code: 'storage/invalid-response' });
    }
    return payload;
  } catch (error) {
    if (controller.signal.aborted) throw Object.assign(new Error('Image upload timed out.'), { code: 'storage/retry-limit-exceeded' });
    throw error;
  } finally { clearTimeout(timer); }
}
