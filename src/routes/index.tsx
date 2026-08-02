import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  GitCompareArrows,
  History,
  Import,
  RefreshCw,
  ScanLine,
  X,
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
import { normalizeImportedBlueprint } from "@/lib/blueprint/import-normalize";
import type { Blueprint } from "@/lib/blueprint/types";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: HomePage,
});

type Overlay = "none" | "history" | "compare";

function HomePage() {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [history, setHistory] = useState<BlueprintSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>("none");

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
    setOverlay("none");
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
        const parsed = normalizeImportedBlueprint(JSON.parse(text));
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

  const showResult = Boolean(blueprint);

  return (
    <div className="relative min-h-dvh bg-bg">
      {/* SCREEN 1 · SCAN */}
      {!showResult && (
        <section className="relative min-h-dvh w-full flex flex-col items-center justify-center px-4 py-10 overflow-hidden">
          <div aria-hidden className="ambient-glow" />

          <div className="w-full max-w-[540px] flex flex-col gap-8 z-10">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-bg-subtle border border-border text-accent">
                  <ScanLine className="size-5" />
                </div>
                <span className="text-2xl font-semibold tracking-tight text-fg">
                  Blueprint Scanner
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-medium tracking-tight text-fg text-balance">
                Frontend blueprint z akejkoľvek verejnej URL
              </h1>
              <p className="text-sm text-fg-subtle">
                Skenujte weby do čistých architektúr.
              </p>
            </div>

            <div className="panel p-5 sm:p-6 shadow-soft">
              <ScanForm
                onScanned={handleScanned}
                busy={busy}
                setBusy={setBusy}
                compact
              />
            </div>

            <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-2 text-xs text-fg-muted border-t border-border pt-6">
              <button
                type="button"
                onClick={() => setOverlay("history")}
                className="hover:text-fg flex items-center gap-1.5"
              >
                <History className="size-3.5 text-fg-subtle" />
                História ({history.length})
              </button>
              <span className="h-3 w-px bg-border" aria-hidden />
              <button
                type="button"
                onClick={handleImportJson}
                className="hover:text-fg flex items-center gap-1.5"
              >
                <Import className="size-3.5 text-fg-subtle" />
                Import JSON
              </button>
              <span className="h-3 w-px bg-border" aria-hidden />
              <button
                type="button"
                onClick={() => setOverlay("compare")}
                className="hover:text-fg flex items-center gap-1.5"
              >
                <GitCompareArrows className="size-3.5 text-fg-subtle" />
                Porovnať blueprinty
              </button>
            </div>
          </div>
        </section>
      )}

      {/* SCREEN 2 · RESULT */}
      {showResult && blueprint && (
        <section className="h-dvh w-full flex flex-col overflow-hidden bg-bg">
          <header className="h-14 shrink-0 border-b border-border px-3 sm:px-4 flex items-center justify-between gap-3 bg-bg">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-md bg-bg-subtle border border-border text-accent shrink-0">
                <ScanLine className="size-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate mono">
                  {blueprint.sourceUrl || blueprint.meta.title || blueprint.id}
                </div>
                <div className="text-[11px] text-fg-subtle truncate">
                  {blueprint.stats?.pageCount ?? 1} stránok ·{" "}
                  {blueprint.stats?.capturedAssetCount ?? 0} assetov ·{" "}
                  {blueprint.tech?.slice(0, 3).map((t) => t.name).join(" · ") || "—"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOverlay("history")}
                className="hidden sm:inline-flex"
              >
                <History className="size-3.5" />
                História
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setBlueprint(null);
                  setOverlay("none");
                }}
              >
                <RefreshCw className="size-3.5" />
                Nový sken
              </Button>
            </div>
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-3 sm:px-6 py-5 sm:py-6">
              <BlueprintView blueprint={blueprint} />
            </div>
          </div>
        </section>
      )}

      {/* Overlay: History */}
      {overlay === "history" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-bg/70 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setOverlay("none")}
            aria-hidden
          />
          <div className="relative z-10 w-full sm:max-w-md max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-bg-elevated shadow-soft">
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-border bg-bg-elevated">
              <h3 className="text-sm font-semibold">História skenov</h3>
              <button
                type="button"
                onClick={() => setOverlay("none")}
                className="text-fg-subtle hover:text-fg p-1"
                aria-label="Zatvoriť"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-3">
              <HistoryList
                items={history}
                activeId={blueprint?.id}
                onSelect={handleSelect}
                onDelete={handleDelete}
              />
            </div>
          </div>
        </div>
      )}

      {/* Overlay: Compare — keep "Porovnať blueprinty" text for smoke */}
      {overlay === "compare" && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-bg/70 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setOverlay("none")}
            aria-hidden
          />
          <div className="relative z-10 w-full sm:max-w-md max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-border bg-bg-elevated shadow-soft">
            <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-border bg-bg-elevated">
              <h3 className="text-sm font-semibold">Porovnať blueprinty</h3>
              <button
                type="button"
                onClick={() => setOverlay("none")}
                className="text-fg-subtle hover:text-fg p-1"
                aria-label="Zatvoriť"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-3">
              <ComparePanel history={history} current={blueprint} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
