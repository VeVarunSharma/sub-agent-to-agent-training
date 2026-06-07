"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SparklesIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function SiteHeader() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <SparklesIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">SSMUH Pre-Review Copilot</span>
          <span className="sm:hidden">SSMUH</span>
        </Link>
        {crumbs.length > 0 && (
          <Breadcrumb className="hidden md:block">
            <BreadcrumbList>
              {crumbs.map((c, i) => (
                <BreadcrumbCrumb
                  key={c.href ?? c.label}
                  href={c.href}
                  label={c.label}
                  isLast={i === crumbs.length - 1}
                  showSeparator={i > 0}
                />
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function BreadcrumbCrumb({
  href,
  label,
  isLast,
  showSeparator,
}: {
  href?: string;
  label: string;
  isLast: boolean;
  showSeparator: boolean;
}) {
  return (
    <>
      {showSeparator && <BreadcrumbSeparator />}
      <BreadcrumbItem>
        {isLast || !href ? (
          <BreadcrumbPage>{label}</BreadcrumbPage>
        ) : (
          <BreadcrumbLink render={<Link href={href}>{label}</Link>} />
        )}
      </BreadcrumbItem>
    </>
  );
}

function buildCrumbs(pathname: string): Array<{ label: string; href?: string }> {
  if (pathname === "/") return [];
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; href?: string }> = [{ label: "Queue", href: "/" }];
  if (parts[0] === "review" && parts[1]) {
    crumbs.push({ label: parts[1] });
  }
  return crumbs;
}
