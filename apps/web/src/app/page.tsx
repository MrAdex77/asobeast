import { SUPPORTED_STORES } from "@asobeast/shared";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 font-sans">
      <h1 className="text-3xl font-semibold tracking-tight">asobeast</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        supported stores: {SUPPORTED_STORES.join(", ")}
      </p>
    </main>
  );
}
