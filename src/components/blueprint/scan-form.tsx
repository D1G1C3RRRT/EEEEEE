import { useState } from "react";
import {
  Globe2,
  FileCode2,
  Loader2,
  ScanSearch,
  AlertCircle,
  Bot,
  Layers,
  Archive,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { scanBlueprint } from "@/lib/blueprint/server";
import { saveBlueprintLocal } from "@/lib/blueprint/storage";
import type { Blueprint } from "@/lib/blueprint/types";

const EXAMPLES = [
  "https://example.com",
  "https://news.ycombinator.com",
  "https://tailwindcss.com",
];

type Props = {
  onScanned: (bp: Blueprint) => void;
  busy?: boolean;
  setBusy?: (v: boolean) => void;
};

export function ScanForm({ onScanned, busy, setBusy }: Props) {
  const [mode, setMode] = useState<"url" | "html">("url");
  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [maxPages, setMaxPages] = useState(5);
  const [render, setRender] = useState(true);
  const [wayback, setWayback] = useState(true);
  const [captureAssets, setCaptureAssets] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const isBusy = busy ?? localBusy;

  const markBusy = (v: boolean) => {
    setLocalBusy(v);
    setBusy?.(v);
  };

  async function runScan() {
    setError(null);
    markBusy(true);
    try {
      const result = await scanBlueprint({
        data:
          mode === "url"
            ? {
                url: url.trim(),
                maxPages,
                render,
                wayback,
                captureAssets,
              }
            : {
                html,
                baseUrl: baseUrl.trim() || undefined,
                captureAssets,
                maxPages: 1,
                render: false,
                wayback: false,
              },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      saveBlueprintLocal(result.blueprint);
      onScanned(result.blueprint);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sken zlyhal.");
    } finally {
      markBusy(false);
    }
  }

  return (
    <div className="panel p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Skenovať projekt</h2>
        <p className="text-sm text-fg-muted">
          Verejný frontend snapshot: HTML/CSS, multi-page crawl, headless SPA render,
          Wayback fallback, assety do ZIP. Nie je to klon servera ani databázy.
        </p>
      </div>

      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v as "url" | "html")}
        className="w-full"
      >
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="url" className="flex-1 sm:flex-none gap-1.5">
            <Globe2 className="size-3.5" />
            URL
          </TabsTrigger>
          <TabsTrigger value="html" className="flex-1 sm:flex-none gap-1.5">
            <FileCode2 className="size-3.5" />
            Vložiť HTML
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-fg-muted">Adresa stránky</span>
            <Input
              placeholder="https://moja-appka.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && url.trim() && !isBusy) void runScan();
              }}
              autoComplete="url"
              inputMode="url"
              disabled={isBusy}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={isBusy}
                onClick={() => setUrl(ex)}
                className="rounded-full border border-border bg-bg-subtle px-3 py-1 text-xs text-fg-muted transition-colors hover:text-fg"
              >
                {ex.replace(/^https?:\/\//, "")}
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="html" className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-fg-muted">
              Pôvodná URL (voliteľné, na absolútne cesty)
            </span>
            <Input
              placeholder="https://povodna-domena.sk"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={isBusy}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-fg-muted">
              HTML zdroj (View Source / Uložiť ako…)
            </span>
            <Textarea
              placeholder="<!DOCTYPE html>…"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              disabled={isBusy}
              className="min-h-[180px]"
            />
          </label>
        </TabsContent>
      </Tabs>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-bg-subtle/50 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-fg"
            checked={render}
            disabled={isBusy || mode === "html"}
            onChange={(e) => setRender(e.target.checked)}
          />
          <Bot className="size-3.5 text-fg-muted shrink-0" />
          <span className="min-w-0">
            <span className="font-medium text-fg">Headless render</span>
            <span className="block text-xs text-fg-muted">SPA / JS DOM</span>
          </span>
        </label>
        <label className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-bg-subtle/50 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-fg"
            checked={wayback}
            disabled={isBusy || mode === "html"}
            onChange={(e) => setWayback(e.target.checked)}
          />
          <Archive className="size-3.5 text-fg-muted shrink-0" />
          <span className="min-w-0">
            <span className="font-medium text-fg">Wayback fallback</span>
            <span className="block text-xs text-fg-muted">archive.org pri chybe</span>
          </span>
        </label>
        <label className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-bg-subtle/50 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-fg"
            checked={captureAssets}
            disabled={isBusy}
            onChange={(e) => setCaptureAssets(e.target.checked)}
          />
          <Package className="size-3.5 text-fg-muted shrink-0" />
          <span className="min-w-0">
            <span className="font-medium text-fg">Stiahnuť assety</span>
            <span className="block text-xs text-fg-muted">do ZIP exportu</span>
          </span>
        </label>
        <label className="flex items-center gap-2.5 rounded-[var(--radius-md)] border border-border bg-bg-subtle/50 px-3 py-2.5 text-sm">
          <Layers className="size-3.5 text-fg-muted shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="font-medium text-fg">Crawl stránok</span>
            <span className="block text-xs text-fg-muted">same-origin, 1–20</span>
          </span>
          <Input
            type="number"
            min={1}
            max={20}
            value={maxPages}
            disabled={isBusy || mode === "html"}
            onChange={(e) =>
              setMaxPages(Math.min(20, Math.max(1, Number(e.target.value) || 1)))
            }
            className="h-9 w-16 text-center"
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-fg-subtle max-w-md">
          Headless + crawl trvá dlhšie. Pre rýchly test vypni render a nastav 1 stránku.
        </p>
        <Button
          size="lg"
          disabled={isBusy || (mode === "url" ? !url.trim() : !html.trim())}
          onClick={() => void runScan()}
          className="w-full sm:w-auto min-w-[160px]"
        >
          {isBusy ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Skenujem…
            </>
          ) : (
            <>
              <ScanSearch className="size-4" />
              Vytvoriť blueprint
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
