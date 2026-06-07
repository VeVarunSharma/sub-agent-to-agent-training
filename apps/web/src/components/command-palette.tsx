"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import {
  FileTextIcon,
  MonitorIcon,
  MoonIcon,
  PlayIcon,
  SunIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

type CaseEntry = {
  case_id: string;
  label: string;
  outcome_class: string;
};

export function CommandPalette({ cases }: { cases: CaseEntry[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = useCallback(
    (fn: () => void) => {
      setOpen(false);
      fn();
    },
    [],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Jump to a case, run actions, or change theme.">
      <CommandInput placeholder="Type a command or search a case..." />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Cases">
          {cases.map((c) => (
            <CommandItem
              key={c.case_id}
              value={`${c.case_id} ${c.label} ${c.outcome_class}`}
              onSelect={() => run(() => router.push(`/review/${c.case_id}`))}
            >
              <FileTextIcon />
              <span>{c.case_id}</span>
              <span className="ml-2 truncate text-xs text-muted-foreground">{c.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            value="run pre-review pipeline"
            onSelect={() => run(() => window.dispatchEvent(new CustomEvent("ssmuh:run-pipeline")))}
          >
            <PlayIcon />
            <span>Run pre-review on current case</span>
            <CommandShortcut>R</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem value="theme light" onSelect={() => run(() => setTheme("light"))}>
            <SunIcon /> Light
          </CommandItem>
          <CommandItem value="theme dark" onSelect={() => run(() => setTheme("dark"))}>
            <MoonIcon /> Dark
          </CommandItem>
          <CommandItem value="theme system" onSelect={() => run(() => setTheme("system"))}>
            <MonitorIcon /> System
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
