"use client";

import Link from "next/link";
import {
  Building2Icon,
  CarIcon,
  HomeIcon,
  LayoutGridIcon,
  MapPinIcon,
  RulerIcon,
  Table2Icon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import type { OutcomeClass, SsmuhApplicationPacket } from "@srs/shared";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OUTCOME_LABEL } from "@/lib/icons";
import { cn } from "@/lib/utils";

export type QueueCase = {
  case_id: string;
  outcome_class: OutcomeClass;
  application_packet: SsmuhApplicationPacket;
};

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const OUTCOME_VARIANT: Record<OutcomeClass, BadgeVariant> = {
  ready: "secondary",
  "needs-clarification": "default",
  "complex-requires-specialist": "destructive",
};

export function QueueView({ cases }: { cases: QueueCase[] }) {
  const sortedCases = cases.slice().sort((a, b) => a.case_id.localeCompare(b.case_id));

  return (
    <Tabs defaultValue="cards" className="gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Review sample cases</h2>
          <p className="text-sm text-muted-foreground">Switch between case cards and a compact table.</p>
        </div>
        <TabsList aria-label="Queue view">
          <TabsTrigger value="cards">
            <LayoutGridIcon />
            Cards
          </TabsTrigger>
          <TabsTrigger value="table">
            <Table2Icon />
            Table
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="cards" className="mt-0">
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {sortedCases.map((c) => (
            <CaseCard key={c.case_id} item={c} />
          ))}
        </section>
      </TabsContent>

      <TabsContent value="table" className="mt-0">
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Case</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Zoning</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>FSR</TableHead>
                  <TableHead>Parking</TableHead>
                  <TableHead className="pr-4">Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCases.map((c) => {
                  const packet = c.application_packet;

                  return (
                    <TableRow key={c.case_id} className="align-top">
                      <TableCell className="pl-4 font-mono text-xs font-medium">
                        <Link href={`/review/${c.case_id}`} className="text-primary underline-offset-4 hover:underline">
                          {c.case_id}
                        </Link>
                      </TableCell>
                      <TableCell>{packet.address_stub}</TableCell>
                      <TableCell>{packet.zoning_district}</TableCell>
                      <TableCell>{packet.units_proposed}</TableCell>
                      <TableCell>{packet.fsr_proposed.toFixed(2)}</TableCell>
                      <TableCell>
                        {packet.parking_spaces_proposed} / {packet.parking_spaces_required}
                      </TableCell>
                      <TableCell className="pr-4">
                        <OutcomeBadge outcome={c.outcome_class} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function CaseCard({ item }: { item: QueueCase }) {
  const packet = item.application_packet;

  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="font-mono text-base">{item.case_id}</CardTitle>
          <OutcomeBadge outcome={item.outcome_class} />
        </div>
        <CardDescription>{packet.reviewer_notes}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-4 text-sm">
        <div className="grid gap-3">
          <PacketField Icon={HomeIcon} label="Address" value={packet.address_stub} />
          <PacketField Icon={MapPinIcon} label="Zoning district" value={packet.zoning_district} />
          <PacketField Icon={Building2Icon} label="Units" value={`${packet.units_proposed} proposed`} />
          <PacketField Icon={RulerIcon} label="FSR" value={`${packet.fsr_proposed.toFixed(2)} proposed, ${packet.fsr_allowed.toFixed(2)} allowed`} />
          <PacketField Icon={CarIcon} label="Parking" value={`${packet.parking_spaces_proposed} proposed, ${packet.parking_spaces_required} required`} />
          <PacketField Icon={ZapIcon} label="Energy step" value={`Step ${packet.energy_step_code_proposed} proposed, Step ${packet.energy_step_code_required} required`} />
        </div>
      </CardContent>
      <CardFooter>
        <Link href={`/review/${item.case_id}`} className={buttonVariants({ variant: "default", size: "lg", className: "w-full" })}>
          Open packet
        </Link>
      </CardFooter>
    </Card>
  );
}

function PacketField({ Icon, label, value }: { Icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
      <Icon className="mt-0.5 size-4 text-primary" />
      <div className="min-w-0 space-y-1">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-pretty text-foreground">{value}</div>
      </div>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: OutcomeClass }) {
  return (
    <Badge variant={OUTCOME_VARIANT[outcome] ?? "outline"} className={cn(outcome === "ready" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200")}>
      {OUTCOME_LABEL[outcome] ?? outcome}
    </Badge>
  );
}
