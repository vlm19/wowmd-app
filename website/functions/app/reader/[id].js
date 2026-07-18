export async function onRequest(context) {
  const response = await serveAppIndex(context);
  return withNoindex(response);
}

function serveAppIndex(context) {
  const url = new URL(context.request.url);
  url.pathname = '/app/';
  return context.env.ASSETS.fetch(new Request(url, context.request));
}

// SPA workspace route: serve the app shell but keep it out of search indexes.
function withNoindex(response) {
  const sealed = new Response(response.body, response);
  sealed.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return sealed;
}
