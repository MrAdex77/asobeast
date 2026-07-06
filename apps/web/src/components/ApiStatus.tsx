import type { HealthStatus } from "@asobeast/shared";
import { Badge } from "./Badge";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function ApiStatus() {
  let health: HealthStatus | null = null;
  try {
    const res = await fetch(`${BASE}/health`, { cache: "no-store" });
    health = (await res.json()) as HealthStatus;
  } catch {
    health = null;
  }

  const online = health?.status === "ok";

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-zinc-400 dark:text-zinc-500">api</span>
      <Badge tone={online ? "success" : "danger"}>
        {online ? "online" : "unreachable"}
      </Badge>
    </span>
  );
}
