async function callAI<T>(_name: string, _data: Record<string, unknown>): Promise<T> {
  throw new Error('The secure AI service has not been configured.');
}

export const ASSISTANT_NAME = 'حلاقي AI';

export interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const SYSTEM = `أنت ${ASSISTANT_NAME}، مساعد لتطبيق حلاقي. أجب بلغة المستخدم وباختصار. قدّم نصائح عامة للحلاقة، لكن لا تختلق أسماء صالونات أو تقييمات أو أسعاراً أو مواعيد أو أرصدة أو حالة توفر. استخدم بيانات السياق فقط لهذه المعلومات، وإذا لم تتوفر فقل ذلك بوضوح. لا تدّع تنفيذ حجز أو إرسال رسالة؛ وجّه المستخدم إلى أدوات التطبيق لذلك.`;

/* Disabled legacy browser-side provider calls. Third-party AI must go through
   authenticated Firebase Functions so provider keys never ship in the app. */
/* async function* readSSE(response: Response): AsyncGenerator<string> {
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(`API ${response.status}: ${text.slice(0, 200)}`);
  }
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const data = t.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {  }
    }
  }
}

async function* simulateStream(text: string): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += 4) yield text.slice(i, i + 4);
}

async function* pollinationsChat(messages: GrokMessage[], context?: string): AsyncGenerator<string> {
  const sys = context ? `${SYSTEM}\n\n--- السياق الحالي ---\n${context}` : SYSTEM;
  const body = {
    model: 'openai',
    messages: [{ role: 'system', content: sys }, ...messages],
    seed: Math.floor(Math.random() * 9999),
    private: true,
    stream: true,
  };

  try {
    const resp = await fetch(POLLINATIONS_TEXT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (resp.ok && resp.body) { yield* readSSE(resp); return; }
  } catch {  }

  const resp2 = await fetch(POLLINATIONS_TEXT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: false }),
  });
  if (!resp2.ok) throw new Error(`Pollinations ${resp2.status}`);
  const data = await resp2.json();
  yield* simulateStream(data.choices?.[0]?.message?.content ?? '');
}

async function* grokChat(messages: GrokMessage[], context?: string): AsyncGenerator<string> {
  const sys = context ? `${SYSTEM}\n\n--- السياق الحالي ---\n${context}` : SYSTEM;
  const body = {
    model: GROK_TEXT_MODEL,
    messages: [{ role: 'system', content: sys }, ...messages],
    temperature: 0.7,
    max_tokens: 400,
  };
  const headers = { 'Authorization': `Bearer ${GROK_KEY}`, 'Content-Type': 'application/json' };

  try {
    const resp = await fetch(GROK_URL, { method: 'POST', headers, body: JSON.stringify({ ...body, stream: true }) });
    if (resp.ok && resp.body) { yield* readSSE(resp); return; }
  } catch {  }

  const resp2 = await fetch(GROK_URL, { method: 'POST', headers, body: JSON.stringify({ ...body, stream: false }) });
  if (!resp2.ok) throw new Error(`Grok ${resp2.status}`);
  const data = await resp2.json();
  yield* simulateStream(data.choices?.[0]?.message?.content ?? '');
}

export async function* chatStream(history: GrokMessage[], context?: string): AsyncGenerator<string> {
  try {
    yield* pollinationsChat(history, context);
    return;
  } catch {  }

  yield* grokChat(history, context);
}

export async function* analyzeImageStream(imageDataUrl: string, userText: string): AsyncGenerator<string> {
  const base64 = imageDataUrl.split(',')[1];
  const mime = imageDataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
  const prompt = userText.trim() ||
    'حلّل القصة أو الستايل في هذه الصورة كخبير حلاقة. صف نوعها، طولها، الأسلوب، وأي تفاصيل مميزة. اقترح قصات مشابهة أو محسّنة.';

  const headers = { 'Authorization': `Bearer ${GROK_KEY}`, 'Content-Type': 'application/json' };
  const visionBody = {
    model: GROK_VISION_MODEL,
    messages: [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}`, detail: 'high' } },
          { type: 'text', text: prompt },
        ],
      },
    ],
    max_tokens: 500,
  };

  try {
    const resp = await fetch(GROK_URL, { method: 'POST', headers, body: JSON.stringify({ ...visionBody, stream: true }) });
    if (resp.ok && resp.body) { yield* readSSE(resp); return; }
  } catch {  }

  try {
    const resp = await fetch(GROK_URL, { method: 'POST', headers, body: JSON.stringify({ ...visionBody, stream: false }) });
    if (resp.ok) {
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) { yield* simulateStream(content); return; }
    }
  } catch {  }

  const fallbackMsg = userText.trim()
    ? `المستخدم أرسل صورة مع هذا النص: "${userText}". ساعده بناءً على وصفه.`
    : 'المستخدم أرسل صورة. اطلب منه وصف ما يريد معرفته عن القصة أو الستايل.';
  yield* chatStream([{ role: 'user', content: fallbackMsg }]);
}

export async function generateImage(prompt: string): Promise<string> {
  const full = `${prompt}, professional barber haircut, studio lighting, photorealistic, high quality`;

  try {
    const seed = Math.floor(Math.random() * 99999);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?width=512&height=512&seed=${seed}&nologo=true&model=flux`;
    const resp = await fetch(url);
    if (resp.ok) {
      const blob = await resp.blob();
      if (blob.type.startsWith('image/') && blob.size > 5000) return URL.createObjectURL(blob);
    }
  } catch {  }

  try {
    const headers = { 'Authorization': `Bearer ${REPLICATE_TOKEN}`, 'Content-Type': 'application/json', 'Prefer': 'wait=60' };
    const startResp = await fetch('https://api.replicate.com/v1/models/google/imagen-4/predictions', {
      method: 'POST', headers,
      body: JSON.stringify({ input: { prompt: `Professional barber shop haircut: ${prompt}. Photorealistic, cinematic.`, aspect_ratio: '1:1' } }),
    });
    if (startResp.ok) {
      const prediction = await startResp.json();
      if (prediction.status === 'succeeded') {
        const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
        if (url) return String(url);
      }
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, { headers: { 'Authorization': `Bearer ${REPLICATE_TOKEN}` } });
        if (poll.ok) {
          const data = await poll.json();
          if (data.status === 'succeeded') { const u = Array.isArray(data.output) ? data.output[0] : data.output; if (u) return String(u); }
          if (data.status === 'failed') break;
        }
      }
    }
  } catch {  }

  const seed2 = Math.floor(Math.random() * 99999);
  const url2 = `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?width=512&height=512&seed=${seed2}&nologo=true&model=turbo`;
  const resp2 = await fetch(url2);
  if (!resp2.ok) throw new Error(`Generation failed: ${resp2.status}`);
  const blob2 = await resp2.blob();
  if (!blob2.type.startsWith('image/')) throw new Error('Not an image');
  return URL.createObjectURL(blob2);
}

*/

export async function* chatStream(history: GrokMessage[], context?: string): AsyncGenerator<string> {
  const result = await callAI<{ text: string }>('halaqiAssistant', { history, context });
  if (result.text) yield result.text;
}

export async function* analyzeImageStream(imageDataUrl: string, userText: string): AsyncGenerator<string> {
  const result = await callAI<{ text: string }>('halaqiAssistant', { imageDataUrl, userText });
  if (result.text) yield result.text;
}

export async function generateImage(prompt: string): Promise<string> {
  const result = await callAI<{ imageUrl: string }>('halaqiGenerateImage', { prompt });
  if (!result.imageUrl) throw new Error('Image generation is unavailable.');
  return result.imageUrl;
}

export interface BookingAction {
  barberId?: string;
  barberName?: string;
  service?: string;
  time?: string;
}

export function extractBookingAction(text: string): BookingAction | null {
  const match = text.match(/\[BOOKING(?:_ACTION)?\]\s*(\{[\s\S]*?\})\s*\[\/BOOKING(?:_ACTION)?\]/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

export interface NotifyAction {
  barberId: string;
  barberName: string;
  message: string;
}

export function extractNotifyAction(text: string): NotifyAction | null {
  const match = text.match(/\[NOTIFY\]\s*(\{[\s\S]*?\})\s*\[\/NOTIFY\]/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

export function cleanResponseText(text: string): string {
  return text
    .replace(/\[BOOKING(?:_ACTION)?\][\s\S]*?\[\/BOOKING(?:_ACTION)?\]/g, '')
    .replace(/\[NOTIFY\][\s\S]*?\[\/NOTIFY\]/g, '')
    .trim();
}
