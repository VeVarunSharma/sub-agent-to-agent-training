import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className="relative block">
      <select
        data-slot="select"
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-input bg-background px-3 py-2 pr-9 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>
  )
}

function SelectItem({ children, ...props }: React.ComponentProps<"option">) {
  return <option {...props}>{children}</option>
}

export { Select, SelectItem }
