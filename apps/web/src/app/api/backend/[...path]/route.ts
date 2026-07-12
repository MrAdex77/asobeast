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

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers: {
        "content-type":
          request.headers.get("content-type") ?? "application/json",
      },
      body,
      cache: "no-store",
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
      },
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
