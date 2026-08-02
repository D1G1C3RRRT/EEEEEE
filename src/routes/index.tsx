import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Fingerprint,
  Import,
  ScanLine,
  Shield,
  Sparkles,
} from "lucide-react";
import { ScanForm } from "@/components/blueprint/scan-form";
import { BlueprintView } from "@/components/blueprint/blueprint-view";
import { HistoryList } from "@/components/blueprint/history-list";
import { ComparePanel } from "@/components/blueprint/compare-panel";
import { Button } from "@/components/ui/button";
import {
  deleteLocalBlueprint,
  listLocalBlueprints,
  loadLocalBlueprint,
  saveBlueprintLocal,
  type BlueprintSummary,
} from "@/lib/blueprint/storage";
import type { Blueprint } from "@/lib/blueprint/types";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [history, setHistory] = useState<BlueprintSummary[]>([]);
  const [busy, setBusy] = useState(false);

  const refreshHistory = useCallback(() => {
    setHistory(listLocalBlueprints());
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  function handleScanned(bp: Blueprint) {
    setBlueprint(bp);
    refreshHistory();
    toast.success("Blueprint pripravený", {
      description: `${bp.id} · ${bp.stats?.pageCount ?? 1} stránok`,
    });
  }

  function handleSelect(id: string) {
    const bp = loadLocalBlueprint(id);
    if (!bp) {
      toast.error("Blueprint sa nenašiel v lokálnom úložisku");
      return;
    }
    setBlueprint(bp);
  }

  function handleDelete(id: string) {
    deleteLocalBlueprint(id);
    if (blueprint?.id === id) setBlueprint(null);
    refreshHistory();
    toast.message("Blueprint zmazaný");
  }

  function handleImportJson() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as Blueprint;
        if (!parsed?.id || !parsed?.version || !parsed?.html) {
          throw new Error("Neplatný formát blueprintu");
        }
        // normalize v1.0 → v1.1 fields
        if (!parsed.pages) parsed.pages = [];
        if (!parsed.options) {
          parsed.options = {
            maxPages: 1,
            render: false,
            wayback: false,
            captureAssets: false,
            wpJetEngine: false,
          };
        } else if (parsed.options.wpJetEngine == null) {
          parsed.options.wpJetEngine = false;
        }
        if (parsed.wordpress === undefined) parsed.wordpress = null;
        if (parsed.elementorTemplate === undefined) parsed.elementorTemplate = null;
        if (parsed.rendered == null) parsed.rendered = false;
        if (parsed.waybackUrl === undefined) parsed.waybackUrl = null;
        if (!parsed.stats.pageCount) parsed.stats.pageCount = 1;
        if (parsed.stats.capturedAssetCount == null) {
          parsed.stats.capturedAssetCount = parsed.assets.filter(
            (a) => a.captured,
          ).length;
        }
        saveBlueprintLocal(parsed);
        setBlueprint(parsed);
        refreshHistory();
        toast.success("Blueprint importovaný");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Import zlyhal");
      }
    };
    input.click();
  }

  return (
    <div className="relative min-h-dvh">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--color-fg)_6%,transparent),transparent_65%)]"
      />

      <header className="relative border-b border-border/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-bg-elevated">
              <ScanLine className="size-4 text-fg" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight">Blueprint</div>
              <div className="truncate text-xs text-fg-muted">
                Frontend snapshot · crawl · render · export
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleImportJson}>
            <Import className="size-3.5" />
            Import JSON
          </Button>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="mb-8 max-w-2xl">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-elevated px-3 py-1 text-xs text-fg-muted">
            <Sparkles className="size-3" />
            Sken · Crawl · Headless · Wayback · ZIP
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-balance leading-[1.15]">
            Frontend blueprint z akejkoľvek verejnej URL
          </h1>
          <p className="mt-3 text-base text-fg-muted text-pretty leading-relaxed">
            Reverse-spec verejného frontendu: multi-page crawl, SPA headless render,
            archive.org fallback, stiahnuté assety, compare snapshotov. Backend a DB
            zvonku nevie — a otvorene to hovorí.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6 min-w-0">
            <ScanForm onScanned={handleScanned} busy={busy} setBusy={setBusy} />
            {blueprint ? (
              <BlueprintView blueprint={blueprint} />
            ) : (
              <EmptyState />
            )}
          </div>
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <HistoryList
              items={history}
              activeId={blueprint?.id}
              onSelect={handleSelect}
              onDelete={handleDelete}
            />
            <ComparePanel history={history} current={blueprint} />
            <div className="panel p-4 space-y-3 text-sm text-fg-muted">
              <div className="flex items-center gap-2 text-fg font-medium text-sm">
                <Shield className="size-4" />
                Čo vieš získať
              </div>
              <ul className="space-y-2 text-xs leading-relaxed">
                <li>Headless DOM (SPA) + HTTP HTML</li>
                <li>Same-origin crawl (až 20 stránok)</li>
                <li>Wayback Machine fallback</li>
                <li>Assety v ZIP + design tokeny</li>
                <li>Compare dvoch blueprintov</li>
                <li>História local + server vault</li>
              </ul>
              <div className="flex items-center gap-2 pt-1 text-fg font-medium text-sm">
                <Fingerprint className="size-4" />
                Čo nie
              </div>
              <p className="text-xs leading-relaxed">
                Databáza, heslá, serverový kód a privátne API. Pre mŕtvy localhost vlož
                uložené HTML.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="panel flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-[var(--radius-md)] border border-border bg-bg-subtle">
        <ScanLine className="size-5 text-fg-muted" />
      </div>
      <h3 className="text-base font-semibold">Žiadny aktívny blueprint</h3>
      <p className="max-w-sm text-sm text-fg-muted">
        Spusti sken URL (s crawl/render), vlož HTML, alebo importuj JSON.
      </p>
    </div>
  );
}
