export async function onRequest(context) {
  const { request, params } = context;
  const incomingUrl = new URL(request.url);

  const rawPath = params.path;
  const suffix = Array.isArray(rawPath)
    ? rawPath.join('/')
    : String(rawPath || '');

  const upstreamUrl = new URL(
    `https://explorer.zkas.info/api${suffix ? `/${suffix}` : ''}`,
  );
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers();
  headers.set('Accept', request.headers.get('Accept') || 'application/json');
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);

  const init = {
    method: request.method,
    headers,
    redirect: 'follow',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('Cache-Control', 'no-store');

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return Response.json(
      {
        error: 'zkas_upstream_unreachable',
        message: error instanceof Error ? error.message : 'Upstream request failed',
      },
      { status: 502 },
    );
  }
}
