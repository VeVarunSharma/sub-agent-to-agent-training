"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SparklesIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu";

const NAV_LINKS = [
  { href: "/", label: "Queue" },
  { href: "/review/van-ssmuh-train-001", label: "Sample review" },
  { href: "/decisions/submit", label: "Submit" },
  { href: "/decisions/stub-demo", label: "Run" },
  { href: "/evals/dashboard", label: "Evals" },
  { href: "/iterations", label: "Iterations" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center gap-3 px-6 py-2 sm:px-10">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <SparklesIcon className="size-4" />
          </span>
          <span className="hidden sm:inline">SSMUH Pre-Review Copilot</span>
          <span className="sm:hidden">SSMUH</span>
        </Link>
        <NavigationMenu className="order-last w-full max-w-none justify-start lg:order-none lg:w-auto" aria-label="Main navigation">
          <NavigationMenuList className="flex-wrap justify-start gap-1">
            {NAV_LINKS.map((item) => (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuLink
                  render={
                    <Link
                      href={item.href}
                      className={cn(
                        "rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                        isActivePath(pathname, item.href) && "bg-muted text-foreground"
                      )}
                    >
                      {item.label}
                    </Link>
                  }
                />
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
        {crumbs.length > 0 && (
          <Breadcrumb className="hidden xl:block">
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

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/review/van-ssmuh-train-001") return pathname.startsWith("/review");
  if (href === "/decisions/stub-demo") return pathname.startsWith("/decisions/") && pathname !== "/decisions/submit";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function buildCrumbs(pathname: string): Array<{ label: string; href?: string }> {
  if (pathname === "/") return [];
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: Array<{ label: string; href?: string }> = [{ label: "Queue", href: "/" }];
  if (parts[0] === "review" && parts[1]) crumbs.push({ label: parts[1] });
  if (parts[0] === "decisions" && parts[1] === "submit") crumbs.push({ label: "Submit" });
  if (parts[0] === "decisions" && parts[1] !== "submit") crumbs.push({ label: "Run" });
  if (parts[0] === "evals") crumbs.push({ label: "Evals" });
  if (parts[0] === "iterations") crumbs.push({ label: "Iterations" });
  return crumbs;
}
