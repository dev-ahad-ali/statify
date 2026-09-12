interface PagesEnv {
  API_URL: string;
}

export const onRequest = async (context: {
  request: Request;
  env: PagesEnv;
}): Promise<Response> => {
  const incomingUrl = new URL(context.request.url);
  const upstreamUrl = new URL(context.env.API_URL);

  upstreamUrl.pathname =
    incomingUrl.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  upstreamUrl.search = incomingUrl.search;

  const headers = new Headers(context.request.headers);
  headers.delete("host");

  const upstreamRequest = new Request(upstreamUrl, {
    method: context.request.method,
    headers,
    body: ["GET", "HEAD"].includes(context.request.method)
      ? undefined
      : context.request.body,
    redirect: "manual",
  });

  const response = await fetch(upstreamRequest);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
