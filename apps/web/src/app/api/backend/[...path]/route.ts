import { NextRequest } from "next/server";
import type { ApiErrorEnvelope } from "@asobeast/shared";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;
  const url = `${API_BASE}/${path.join("/")}${request.nextUrl.search}`;
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  const headers = new Headers({
    "content-type": request.headers.get("content-type") ?? "application/json",
  });
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("authorization", authorization);

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });
    const responseHeaders = new Headers({
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    });
    for (const setCookie of upstream.headers.getSetCookie()) {
      responseHeaders.append("set-cookie", setCookie);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    const envelope: ApiErrorEnvelope = {
      statusCode: 502,
      error: "Bad Gateway",
      message: "The API is unreachable.",
      path: request.nextUrl.pathname,
      timestamp: new Date().toISOString(),
    };
    return Response.json(envelope, { status: 502 });
  }
}

export {
  forward as GET,
  forward as POST,
  forward as PUT,
  forward as PATCH,
  forward as DELETE,
};
