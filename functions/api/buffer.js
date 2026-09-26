function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
}

function clean(value, max = 10000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function gqlString(value) {
  return JSON.stringify(String(value));
}

async function bufferRequest(apiKey, query) {
  const response = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || `Buffer returned HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload.data;
}

async function authorized(request, env) {
  if (!env.BUFFER_ADMIN_TOKEN) return false;
  const supplied = request.headers.get('X-ZKAS-Admin-Token') || '';
  if (!supplied || supplied.length !== env.BUFFER_ADMIN_TOKEN.length) return false;
  const a = new TextEncoder().encode(supplied);
  const b = new TextEncoder().encode(env.BUFFER_ADMIN_TOKEN);
  return crypto.subtle.timingSafeEqual ? crypto.subtle.timingSafeEqual(a, b) : supplied === env.BUFFER_ADMIN_TOKEN;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && origin !== url.origin) return json({ message: 'Invalid request origin.' }, 403);
  if (!env.BUFFER_API_KEY || !env.BUFFER_ADMIN_TOKEN) return json({ message: 'Buffer connection is not configured.' }, 503);
  if (!(await authorized(request, env))) return json({ message: 'Admin access required.' }, 401);

  try {
    if (request.method === 'GET') {
      const account = await bufferRequest(env.BUFFER_API_KEY, `query GetOrganizations {
        account { name timezone organizations { id name } }
      }`);
      const organizations = account?.account?.organizations || [];
      const channelGroups = await Promise.all(organizations.map(async (org) => {
        const data = await bufferRequest(env.BUFFER_API_KEY, `query GetChannels {
          channels(input: { organizationId: ${gqlString(org.id)}, filter: { isLocked: false } }) {
            id name displayName service avatar isQueuePaused
          }
        }`);
        return { ...org, channels: data?.channels || [] };
      }));
      return json({ ok: true, account: { name: account?.account?.name || null, timezone: account?.account?.timezone || null }, organizations: channelGroups });
    }

    if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const text = clean(body.text, 12000);
      const channelId = clean(body.channelId, 200);
      const mode = body.mode === 'addToQueue' ? 'addToQueue' : 'customScheduled';
      const dueAt = clean(body.dueAt, 80);
      if (!text || !channelId) return json({ message: 'Post text and Buffer channel are required.' }, 400);
      if (mode === 'customScheduled' && (!dueAt || Number.isNaN(Date.parse(dueAt)))) return json({ message: 'A valid scheduled date/time is required.' }, 400);

      const due = mode === 'customScheduled' ? `, dueAt: ${gqlString(new Date(dueAt).toISOString())}` : '';
      const data = await bufferRequest(env.BUFFER_API_KEY, `mutation CreatePost {
        createPost(input: {
          text: ${gqlString(text)}
          channelId: ${gqlString(channelId)}
          schedulingType: automatic
          mode: ${mode}
          aiAssisted: true
          assets: []
          needsApproval: false
          ${due}
        }) {
          ... on PostActionSuccess { post { id text dueAt status channelId } }
          ... on MutationError { message }
        }
      }`);
      const result = data?.createPost;
      if (result?.message) return json({ message: result.message }, 400);
      return json({ ok: true, post: result?.post || null });
    }

    return json({ message: 'Method not allowed.' }, 405);
  } catch (error) {
    return json({ message: error instanceof Error ? error.message : 'Buffer request failed.' }, 502);
  }
}
