import { AlertCircleIcon, FileTextIcon } from "lucide-react"
import type { SsmuhApplicationPacket } from "@srs/shared"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function DocumentList({ packet }: { packet: SsmuhApplicationPacket }) {
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FileTextIcon className="size-4 text-muted-foreground" />
          Submitted documents
        </h3>
        <ul className="space-y-2">
          {packet.submitted_documents.map((doc) => (
            <li key={doc.doc_id} className="flex items-start gap-2 rounded-lg border bg-muted/20 p-2.5">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="mt-0.5 inline-flex h-5 shrink-0 items-center rounded-full border px-2 font-mono text-[11px] text-muted-foreground">
                      {doc.doc_id}
                    </span>
                  }
                />
                <TooltipContent>{doc.title}</TooltipContent>
              </Tooltip>
              <span className="text-sm leading-5">{doc.title}</span>
            </li>
          ))}
        </ul>
      </section>

      {packet.missing_documents.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertCircleIcon className="size-4" />
            Missing documents
          </h3>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-destructive">
            {packet.missing_documents.map((item) => (
              <li key={item}>
                <Badge variant="destructive">{item}</Badge>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
