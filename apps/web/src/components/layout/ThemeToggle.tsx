"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const ORDER = ["light", "dark", "system"] as const;
type ThemeChoice = (typeof ORDER)[number];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const current: ThemeChoice = ORDER.includes(theme as ThemeChoice)
    ? (theme as ThemeChoice)
    : "system";

  function cycle() {
    setTheme(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycle}
      aria-label={`Theme: ${current}. Switch theme`}
    >
      {current === "light" && <Sun className="size-4" />}
      {current === "dark" && <Moon className="size-4" />}
      {current === "system" && <Monitor className="size-4" />}
    </Button>
  );
}
