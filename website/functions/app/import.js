export async function onRequest(context) {
  return serveAppIndex(context);
}

function serveAppIndex(context) {
  const url = new URL(context.request.url);
  url.pathname = '/app/';
  return context.env.ASSETS.fetch(new Request(url, context.request));
}
