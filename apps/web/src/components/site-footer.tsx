export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-muted/30 py-4 text-xs text-muted-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-1 px-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <p>
          Demo only. Fictional applicants and addresses. Not affiliated with the City of Vancouver.
        </p>
        <p className="font-mono">
          Tutorial repo for GHCP CLI fleet-mode sub-agents on Azure AI Foundry.
        </p>
      </div>
    </footer>
  );
}
