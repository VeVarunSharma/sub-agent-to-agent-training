import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { listSampleCases } from "@srs/shared";
import { CommandPalette } from "@/components/command-palette";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SSMUH Pre-Review Copilot",
  description:
    "A staff-facing copilot for the City of Vancouver SSMUH permit intake. Tutorial repo for GHCP CLI fleet-mode sub-agents iterating on Azure AI Foundry agents.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cases = listSampleCases().map((c) => ({
    case_id: c.case_id,
    label: `${c.case_id} · ${(c.application_packet as { address_stub: string }).address_stub}`,
    outcome_class: c.outcome_class,
  }));
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delay={150}>
            <SiteHeader />
            <div className="flex flex-1 flex-col">{children}</div>
            <SiteFooter />
            <CommandPalette cases={cases} />
            <Toaster richColors closeButton position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
