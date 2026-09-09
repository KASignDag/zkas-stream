const MAX_TOTAL_BYTES = 6_000_000;
const MAX_FILES = 3;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function text(value, limit) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

async function rateKey(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const hash = [...new Uint8Array(digest)].slice(0, 12).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `wallet-feedback-rate:${hash}:${Math.floor(Date.now() / 3_600_000)}`;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ message: 'Method not allowed.' }, 405);

  const requestUrl = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && origin !== requestUrl.origin) return json({ message: 'Invalid request origin.' }, 403);
  if (!env.DISCORD_FEEDBACK_WEBHOOK_URL) return json({ message: 'Feedback is temporarily unavailable.' }, 503);
  if (!env.OTC_TRADES) return json({ message: 'Feedback protection is temporarily unavailable.' }, 503);

  const declaredSize = Number(request.headers.get('Content-Length') || 0);
  if (declaredSize > MAX_TOTAL_BYTES + 100_000) return json({ message: 'Attachments must be 6 MB or less in total.' }, 413);

  const key = await rateKey(request);
  const attempts = Number(await env.OTC_TRADES.get(key) || 0);
  if (attempts >= 5) return json({ message: 'Too many reports were sent. Please try again later.' }, 429);

  let form;
  try { form = await request.formData(); } catch { return json({ message: 'The feedback form could not be read.' }, 400); }
  if (text(form.get('website'), 100)) return json({ ok: true });

  const name = text(form.get('name'), 80) || 'Anonymous tester';
  const device = text(form.get('device'), 120);
  const message = text(form.get('message'), 1500);
  if (!device || !message) return json({ message: 'Phone/version and feedback are required.' }, 400);

  const files = form.getAll('screenshots').filter((item) => item instanceof File && item.size > 0);
  if (files.length > MAX_FILES) return json({ message: 'Attach no more than 3 screenshots.' }, 400);
  let totalBytes = 0;
  for (const file of files) {
    totalBytes += file.size;
    if (!ALLOWED_TYPES.has(file.type)) return json({ message: 'Screenshots must be PNG, JPEG or WebP images.' }, 400);
  }
  if (totalBytes > MAX_TOTAL_BYTES) return json({ message: 'Attachments must be 6 MB or less in total.' }, 413);

  let webhook;
  try {
    webhook = new URL(env.DISCORD_FEEDBACK_WEBHOOK_URL);
    if (webhook.protocol !== 'https:' || !['discord.com', 'discordapp.com'].includes(webhook.hostname)) throw new Error('invalid');
  } catch {
    return json({ message: 'Feedback is temporarily unavailable.' }, 503);
  }

  const payload = new FormData();
  payload.append('payload_json', JSON.stringify({
    username: 'Stream Wallet Feedback',
    allowed_mentions: { parse: [] },
    embeds: [{
      title: 'New Android community-test feedback',
      color: 0x18b99a,
      fields: [
        { name: 'Tester', value: name || 'Anonymous tester', inline: true },
        { name: 'Android device', value: device, inline: true },
        { name: 'Feedback', value: message },
      ],
      timestamp: new Date().toISOString(),
    }],
  }));
  files.forEach((file, index) => payload.append(`files[${index}]`, file, `screenshot-${index + 1}.${file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]}`));

  const response = await fetch(webhook.toString(), { method: 'POST', body: payload });
  if (!response.ok) return json({ message: 'Discord could not accept the report. Please try again.' }, 502);

  await env.OTC_TRADES.put(key, String(attempts + 1), { expirationTtl: 7200 });
  return json({ ok: true });
}
