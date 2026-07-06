import Image from "next/image";

export function AppIcon({
  src,
  name,
  size = 48,
}: {
  src: string | null;
  name: string | null;
  size?: number;
}) {
  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-sm font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
      >
        {(name?.trim()[0] ?? "?").toUpperCase()}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={name ?? "app icon"}
      width={size}
      height={size}
      className="shrink-0 rounded-xl"
    />
  );
}
