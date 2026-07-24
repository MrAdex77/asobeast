import { NextRequest } from "next/server";
import type { ApiErrorEnvelope } from "@asobeast/shared";

const API_BASE = process.env.API_INTERNAL_URL ?? "http://localhost:4000";
const UPSTREAM_TIMEOUT_MS = Number(
  process.env.API_PROXY_TIMEOUT_MS ?? 30_000,
);

const FORWARDED_HEADERS = [
  "cookie",
  "authorization",
  "x-forwarded-for",
  "x-real-ip",
] as const;

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
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
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
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    const envelope: ApiErrorEnvelope = {
      statusCode: timedOut ? 504 : 502,
      error: timedOut ? "Gateway Timeout" : "Bad Gateway",
      message: timedOut
        ? "The API did not respond in time."
        : "The API is unreachable.",
      path: request.nextUrl.pathname,
      timestamp: new Date().toISOString(),
    };
    return Response.json(envelope, { status: envelope.statusCode });
  }
}

export {
  forward as GET,
  forward as POST,
  forward as PUT,
  forward as PATCH,
  forward as DELETE,
};
