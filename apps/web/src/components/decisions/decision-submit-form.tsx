"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import type { DecisionCaseOption } from "../../../lib/decisions"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectItem } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export function DecisionSubmitForm({ cases }: { cases: DecisionCaseOption[] }) {
  const router = useRouter()
  const [caseId, setCaseId] = useState(cases[0]?.caseId ?? "")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/decisions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, notes }),
      })
      const payload = (await response.json()) as { runId?: string; error?: string }
      if (!response.ok || !payload.runId) throw new Error(payload.error ?? "Unable to create the stub run.")
      router.push(`/decisions/${payload.runId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the stub run.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form onSubmit={onSubmit} className="space-y-6">
      <FormField>
        <FormLabel htmlFor="caseId">Case</FormLabel>
        <FormControl>
          <Select id="caseId" name="caseId" value={caseId} onChange={(event) => setCaseId(event.target.value)} required>
            {cases.map((item) => (
              <SelectItem key={item.caseId} value={item.caseId}>
                {item.label}
              </SelectItem>
            ))}
          </Select>
        </FormControl>
        <FormDescription>Load synthetic case IDs from the local stub.</FormDescription>
      </FormField>

      <FormField>
        <FormLabel htmlFor="notes">Notes</FormLabel>
        <FormControl>
          <Textarea
            id="notes"
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add intake context for the stub run."
            className="min-h-28"
          />
        </FormControl>
        <FormDescription>Keep notes synthetic. Do not add applicant data.</FormDescription>
      </FormField>

      {error ? <FormMessage role="alert">{error}</FormMessage> : null}

      <Button type="submit" size="lg" disabled={isSubmitting || !caseId}>
        {isSubmitting ? "Submitting..." : "Submit pre-review packet"}
      </Button>
    </Form>
  )
}
