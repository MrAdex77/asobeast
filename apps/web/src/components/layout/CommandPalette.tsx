"use client";

import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Search, Settings } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { SECTIONS } from "@/components/app-detail/SectionNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { storeLabel } from "@/lib/format";
import { appsOptions } from "@/lib/queries";

const GENERAL = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const appId = params?.id;
  const { data: apps } = useQuery({ ...appsOptions, enabled: open });

  const openRef = useRef(open);

  const handleOpenChange = useCallback((next: boolean) => {
    openRef.current = next;
    setOpen(next);
    if (!next) {
      setQuery("");
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleOpenChange(!openRef.current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleOpenChange]);

  const go = useCallback(
    (href: string) => {
      handleOpenChange(false);
      router.push(href);
    },
    [handleOpenChange, router],
  );

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open command palette"
              onClick={() => handleOpenChange(true)}
            >
              <Search />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Search — ⌘K</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Command palette"
        description="Jump to an app, a section or a page."
      >
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search apps and sections…"
          />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>

            {apps && apps.length > 0 ? (
              <CommandGroup heading="Apps">
                {apps.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.name ?? "Untitled app"} ${storeLabel(item.store)} ${item.country}`}
                    onSelect={() => go(`/apps/${item.id}`)}
                  >
                    <AppIcon src={item.iconUrl} name={item.name} size={20} />
                    <span className="truncate">
                      {item.name ?? "Untitled app"}
                    </span>
                    <Badge variant="secondary" className="ml-auto">
                      {storeLabel(item.store)}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {appId ? (
              <CommandGroup heading="Sections">
                {SECTIONS.map((section) => (
                  <CommandItem
                    key={section.segment || "overview"}
                    value={`section ${section.label}`}
                    onSelect={() =>
                      go(
                        section.segment
                          ? `/apps/${appId}/${section.segment}`
                          : `/apps/${appId}`,
                      )
                    }
                  >
                    {section.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            <CommandGroup heading="General">
              {GENERAL.map((entry) => (
                <CommandItem
                  key={entry.href}
                  value={entry.label}
                  onSelect={() => go(entry.href)}
                >
                  <entry.icon />
                  {entry.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
