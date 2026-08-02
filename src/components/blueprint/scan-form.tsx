import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
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
  Blocks,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { scanBlueprint } from "@/lib/blueprint/server";
import { saveBlueprintLocal } from "@/lib/blueprint/storage";
import type { Blueprint } from "@/lib/blueprint/types";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "https://example.com",
  "https://news.ycombinator.com",
  "https://tailwindcss.com",
];

/** Long-press threshold (ms) before toggle activates */
const LONG_PRESS_MS = 500;
/** Pointer move (px) cancels pending long-press */
const MOVE_CANCEL_PX = 8;
/** Tooltip auto-hide */
const TIP_MS = 2200;

type Props = {
  onScanned: (bp: Blueprint) => void;
  busy?: boolean;
  setBusy?: (v: boolean) => void;
  /** Compact mode for centered 100dvh shell (hides long copy) */
  compact?: boolean;
};

type IconToggleProps = {
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
  label: string;
  description: string;
  testId: string;
  children: ReactNode;
};

/**
 * Short tap/click → tooltip only (does NOT toggle).
 * Long-press ≥ LONG_PRESS_MS → toggles.
 * Keyboard Space/Enter → toggles (a11y / desktop exception).
 */
function IconToggle({
  active,
  disabled,
  onToggle,
  label,
  description,
  testId,
  children,
}: IconToggleProps) {
  const [tipOpen, setTipOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const [pressScale, setPressScale] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const didToggleRef = useRef(false);
  const holdingRef = useRef(false);

  const clearHoldTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    holdingRef.current = false;
    setHolding(false);
  }, []);

  const showTip = useCallback(() => {
    setTipOpen(true);
    if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    tipTimerRef.current = setTimeout(() => setTipOpen(false), TIP_MS);
  }, []);

  const hideTip = useCallback(() => {
    setTipOpen(false);
    if (tipTimerRef.current) {
      clearTimeout(tipTimerRef.current);
      tipTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearHoldTimer();
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    };
  }, [clearHoldTimer]);

  useEffect(() => {
    if (!tipOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideTip();
    };
    const onDoc = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.(`[data-testid="${testId}"]`)) return;
      hideTip();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDoc);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDoc);
    };
  }, [tipOpen, hideTip, testId]);

  function fireToggle() {
    if (disabled) return;
    didToggleRef.current = true;
    hideTip();
    try {
      navigator.vibrate?.(10);
    } catch {
      /* ignore */
    }
    setPressScale(true);
    window.setTimeout(() => setPressScale(false), 140);
    onToggle();
  }

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    didToggleRef.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    holdingRef.current = true;
    setHolding(true);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (!holdingRef.current) return;
      holdingRef.current = false;
      setHolding(false);
      fireToggle();
    }, LONG_PRESS_MS);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!startPos.current || !holdingRef.current) return;
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
      clearHoldTimer();
      startPos.current = null;
    }
  }

  function onPointerUp() {
    const wasHolding = holdingRef.current || timerRef.current !== null;
    clearHoldTimer();
    startPos.current = null;
    if (wasHolding && !didToggleRef.current && !disabled) {
      showTip();
    }
  }

  function onPointerCancel() {
    clearHoldTimer();
    startPos.current = null;
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    // a11y: keyboard toggles directly (long-press is pointer/touch model)
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      fireToggle();
    }
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        data-testid={testId}
        role="switch"
        aria-checked={active}
        aria-label={label}
        aria-describedby={tipOpen ? `${testId}-tip` : undefined}
        title={label}
        disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
        onClick={(e) => {
          // Native click after pointer sequence must never toggle
          e.preventDefault();
          e.stopPropagation();
        }}
        className={cn(
          "toggle-btn h-10 w-10 flex items-center justify-center rounded-full border transition-all duration-150",
          active
            ? "toggle-neon-ring bg-bg-subtle text-accent border-transparent"
            : "text-fg-subtle border-transparent hover:text-fg-muted",
          disabled && "opacity-40 pointer-events-none",
          pressScale && "scale-95",
          holding && !disabled && "scale-[0.97]",
        )}
      >
        {holding && !disabled && (
          <span className="toggle-hold-progress" aria-hidden />
        )}
        {children}
      </button>
      {tipOpen && (
        <div id={`${testId}-tip`} role="tooltip" className="toggle-tip">
          <span className="font-medium text-accent">{label}</span>
          <span className="block text-fg-muted mt-0.5">{description}</span>
        </div>
      )}
    </div>
  );
}

export function ScanForm({ onScanned, busy, setBusy, compact = false }: Props) {
  const [mode, setMode] = useState<"url" | "html">("url");
  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [maxPages, setMaxPages] = useState(5);
  const [render, setRender] = useState(true);
  const [wayback, setWayback] = useState(true);
  const [captureAssets, setCaptureAssets] = useState(true);
  const [wpJetEngine, setWpJetEngine] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const isBusy = busy ?? localBusy;
  const crawlOn = maxPages > 1;

  const markBusy = (v: boolean) => {
    setLocalBusy(v);
    setBusy?.(v);
  };

  function cancelScan() {
    cancelledRef.current = true;
    abortRef.current?.abort();
    markBusy(false);
    setError("Sken bol zrušený.");
  }

  async function runScan() {
    setError(null);
    cancelledRef.current = false;
    const ac = new AbortController();
    abortRef.current = ac;
    markBusy(true);
    try {
      const payload =
        mode === "url"
          ? {
              url: url.trim(),
              maxPages,
              render,
              wayback,
              captureAssets,
              wpJetEngine,
            }
          : {
              html,
              baseUrl: baseUrl.trim() || undefined,
              captureAssets,
              maxPages: 1,
              render: false,
              wayback: false,
              wpJetEngine,
            };

      const result = await (
        scanBlueprint as (args: {
          data: typeof payload;
          signal?: AbortSignal;
        }) => Promise<
          { ok: true; blueprint: Blueprint } | { ok: false; error: string }
        >
      )({
        data: payload,
        signal: ac.signal,
      });

      if (cancelledRef.current || ac.signal.aborted) {
        setError("Sken bol zrušený.");
        return;
      }

      if (!result.ok) {
        setError(result.error);
        return;
      }
      saveBlueprintLocal(result.blueprint);
      onScanned(result.blueprint);
    } catch (e) {
      if (
        cancelledRef.current ||
        ac.signal.aborted ||
        (e instanceof Error &&
          (e.name === "AbortError" || /abort|zrušen/i.test(e.message)))
      ) {
        setError("Sken bol zrušený.");
        return;
      }
      setError(e instanceof Error ? e.message : "Sken zlyhal.");
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      markBusy(false);
    }
  }

  return (
    <div className={cn("w-full", compact ? "" : "panel p-5 sm:p-6")}>
      {!compact && (
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Skenovať projekt</h2>
          <p className="text-sm text-fg-muted">
            Verejný frontend snapshot + voliteľný WordPress/JetEngine clone extract
            (REST, CCT, listing grids, Elementor, sitemap). Nie je to klon servera ani DB.
          </p>
        </div>
      )}
      {compact && <h2 className="sr-only">Skenovať projekt</h2>}

      {/* Segmented URL | HTML */}
      <div className="w-full grid grid-cols-2 p-1 bg-bg border border-border rounded-xl text-xs font-medium mb-5">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setMode("url")}
          className={cn(
            "py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5",
            mode === "url"
              ? "bg-bg-subtle text-fg border border-border font-semibold"
              : "text-fg-muted hover:text-fg border border-transparent",
          )}
        >
          <Globe2 className="size-3.5" />
          URL
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => setMode("html")}
          className={cn(
            "py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5",
            mode === "html"
              ? "bg-bg-subtle text-fg border border-border font-semibold"
              : "text-fg-muted hover:text-fg border border-transparent",
          )}
        >
          <FileCode2 className="size-3.5" />
          Vložiť HTML
        </button>
      </div>

      {/* Primary input with start here badge */}
      <div className="relative pt-2 mb-4">
        <div className="absolute -top-1 left-3 z-20 px-2 py-0.5 rounded-full bg-bg border border-accent/40 text-[10px] font-mono text-accent flex items-center gap-1 start-here-badge">
          <span className="size-1.5 rounded-full bg-accent animate-pulse" />
          start here
        </div>
        <div className="neon-border-wrapper">
          <div className="neon-inner">
            {mode === "url" ? (
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
                className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0 mono text-sm"
              />
            ) : (
              <div className="space-y-2 p-1">
                <Input
                  placeholder="https://povodna-domena.sk"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  disabled={isBusy}
                  className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0 text-xs"
                />
                <Textarea
                  placeholder="<!DOCTYPE html>…"
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  disabled={isBusy}
                  className="min-h-[140px] border-0 bg-transparent shadow-none focus-visible:ring-0 mono text-xs resize-none"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {mode === "url" && !compact && (
        <div className="flex flex-wrap gap-2 mb-4">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              disabled={isBusy}
              onClick={() => setUrl(ex)}
              className="rounded-full border border-border bg-bg px-3 py-1 text-xs text-fg-muted transition-colors hover:text-fg mono"
            >
              {ex.replace(/^https?:\/\//, "")}
            </button>
          ))}
        </div>
      )}
      {mode === "url" && compact && (
        <p className="text-xs text-center text-fg-subtle mb-4">
          Príklad:{" "}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setUrl("https://example.com")}
            className="text-fg-muted hover:text-accent underline mono"
          >
            example.com
          </button>
        </p>
      )}

      {/* Icon toggles — short tap = tip, long-press = toggle */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 mb-2 bg-bg border border-border rounded-full">
        <span className="text-xs text-fg-subtle shrink-0">Možnosti:</span>
        <div className="flex items-center gap-1">
          <IconToggle
            testId="opt-render"
            label="Headless render"
            description="Načíta SPA/JS DOM namiesto surového HTML."
            active={render && mode === "url"}
            disabled={isBusy || mode === "html"}
            onToggle={() => setRender((v) => !v)}
          >
            <Bot className="size-4" />
          </IconToggle>
          <IconToggle
            testId="opt-wayback"
            label="Wayback fallback"
            description="Pri chybe skúsi archive.org snapshot."
            active={wayback && mode === "url"}
            disabled={isBusy || mode === "html"}
            onToggle={() => setWayback((v) => !v)}
          >
            <Archive className="size-4" />
          </IconToggle>
          <IconToggle
            testId="opt-crawl"
            label="Crawl stránok"
            description="Prejde same-origin podstránky (ON = 5, OFF = 1)."
            active={crawlOn && mode === "url"}
            disabled={isBusy || mode === "html"}
            onToggle={() => setMaxPages((n) => (n > 1 ? 1 : 5))}
          >
            <Layers className="size-4" />
          </IconToggle>
          <IconToggle
            testId="opt-assets"
            label="Stiahnuť assety"
            description="Stiahne obrázky/fonty do ZIP exportu."
            active={captureAssets}
            disabled={isBusy}
            onToggle={() => setCaptureAssets((v) => !v)}
          >
            <Package className="size-4" />
          </IconToggle>
          <IconToggle
            testId="opt-wp"
            label="WP / JetEngine clone"
            description="REST, CCT, listing grids, Elementor, sitemap."
            active={wpJetEngine}
            disabled={isBusy}
            onToggle={() => setWpJetEngine((v) => !v)}
          >
            <Blocks className="size-4" />
          </IconToggle>
        </div>
      </div>
      <p className="mb-4 text-[11px] text-fg-subtle text-center sm:text-left">
        Krátky tap = nápoveda · podržanie ≈0,5 s = zapnúť/vypnúť · aktívne = neon
      </p>

      <span className="sr-only">
        Headless render Wayback Stiahnuť assety Crawl WP / JetEngine
      </span>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex w-full flex-col-reverse sm:flex-row gap-2">
          {isBusy && (
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={cancelScan}
              className="w-full sm:w-auto min-w-[120px] border-danger/40 text-danger hover:bg-danger/10"
            >
              <XCircle className="size-4" />
              Zrušiť
            </Button>
          )}
          <Button
            size="lg"
            disabled={isBusy || (mode === "url" ? !url.trim() : !html.trim())}
            onClick={() => void runScan()}
            className="w-full min-w-[160px] bg-primary text-primary-fg hover:bg-primary/90"
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
                <ArrowRight className="size-4 opacity-70" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
