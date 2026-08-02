import { useMemo, useState } from "react";
import {
  Box,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileArchive,
  Hash,
  Layers,
  Link2,
  Palette,
  Eye,
  Check,
  FormInput,
  Network,
  Clock,
  FileJson,
  Bot,
  Archive,
  Files,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  downloadText,
  exportBlueprintJson,
  exportBlueprintZip,
} from "@/lib/blueprint/storage";
import type { Blueprint, DomOutlineNode } from "@/lib/blueprint/types";
import { cn, formatBytes } from "@/lib/utils";

function confVariant(c: "high" | "medium" | "low") {
  if (c === "high") return "success" as const;
  if (c === "medium") return "warning" as const;
  return "default" as const;
}

function sourceLabel(source: Blueprint["source"]) {
  if (source === "html") return "HTML import";
  if (source === "wayback") return "Wayback";
  return "URL sken";
}

function OutlineTree({ node, depth = 0 }: { node: DomOutlineNode; depth?: number }) {
  return (
    <div className={cn(depth > 0 && "ml-3 border-l border-border pl-3")}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-0.5 text-xs mono">
        <span className="text-info">{`<${node.tag}`}</span>
        {node.id && <span className="text-warning">#{node.id}</span>}
        {node.classes?.slice(0, 4).map((c) => (
          <span key={c} className="text-fg-subtle">
            .{c}
          </span>
        ))}
        {node.role && <span className="text-fg-muted">role={node.role}</span>}
        {node.text && (
          <span className="text-fg-muted truncate max-w-[240px]">“{node.text}”</span>
        )}
      </div>
      {node.children?.map((ch, i) => (
        <OutlineTree key={`${ch.tag}-${i}`} node={ch} depth={depth + 1} />
      ))}
    </div>
  );
}

export function BlueprintView({ blueprint }: { blueprint: Blueprint }) {
  const [tab, setTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);

  const pages = blueprint.pages ?? [];
  const capturedCount =
    blueprint.stats?.capturedAssetCount ??
    blueprint.assets.filter((a) => a.captured).length;

  const previewSrc = useMemo(() => {
    const css = blueprint.cssBundles
      .map((b) => `<style data-src="${b.url}">${b.css}</style>`)
      .join("\n");
    if (/<\/head>/i.test(blueprint.html)) {
      return blueprint.html.replace(/<\/head>/i, `${css}</head>`);
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${css}</head><body>${blueprint.html}</body></html>`;
  }, [blueprint]);

  async function copyJson() {
    await navigator.clipboard.writeText(exportBlueprintJson(blueprint));
    setCopied(true);
    toast.success("JSON skopírovaný");
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadJson() {
    downloadText(
      `${blueprint.id}.json`,
      exportBlueprintJson(blueprint),
      "application/json",
    );
    toast.success("JSON stiahnutý");
  }

  async function downloadZip() {
    setZipping(true);
    try {
      await exportBlueprintZip(blueprint);
      toast.success("ZIP archív pripravený");
    } catch {
      toast.error("Export ZIP zlyhal");
    } finally {
      setZipping(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="accent">v{blueprint.version}</Badge>
              <Badge variant="default">{sourceLabel(blueprint.source)}</Badge>
              {blueprint.rendered && (
                <Badge variant="info">
                  <Bot className="size-3 mr-1" />
                  headless
                </Badge>
              )}
              {blueprint.waybackUrl && (
                <Badge variant="warning">
                  <Archive className="size-3 mr-1" />
                  wayback
                </Badge>
              )}
              {blueprint.statusCode != null && (
                <Badge variant={blueprint.statusCode < 400 ? "success" : "danger"}>
                  HTTP {blueprint.statusCode}
                </Badge>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-balance break-words">
              {blueprint.meta.title || "Bez title"}
            </h2>
            <p className="text-sm text-fg-muted break-all mono">{blueprint.id}</p>
            {blueprint.sourceUrl && (
              <a
                href={blueprint.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors"
              >
                <ExternalLink className="size-3.5" />
                {blueprint.finalUrl || blueprint.sourceUrl}
              </a>
            )}
            {blueprint.notes?.length > 0 && (
              <ul className="text-xs text-info space-y-0.5 pt-1">
                {blueprint.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={() => void copyJson()}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              JSON
            </Button>
            <Button variant="secondary" size="sm" onClick={downloadJson}>
              <FileJson className="size-3.5" />
              Stiahnuť JSON
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={zipping}
              onClick={() => void downloadZip()}
            >
              <FileArchive className="size-3.5" />
              {zipping ? "ZIP…" : "Export ZIP"}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: "HTML", value: formatBytes(blueprint.stats.htmlBytes), icon: Code2 },
            { label: "Stránky", value: String(blueprint.stats?.pageCount ?? 1), icon: Files },
            { label: "Assety", value: String(blueprint.stats.assetCount), icon: Box },
            {
              label: "Captured",
              value: String(capturedCount),
              icon: FileArchive,
            },
            { label: "Odkazy", value: String(blueprint.links.length), icon: Link2 },
            { label: "Tech", value: String(blueprint.tech.length), icon: Network },
            { label: "Čas", value: `${blueprint.stats.scanMs} ms`, icon: Clock },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-[var(--radius-md)] border border-border bg-bg-subtle/80 px-3 py-2.5"
            >
              <div className="flex items-center gap-1.5 text-fg-subtle">
                <s.icon className="size-3.5" />
                <span className="text-[11px] font-medium uppercase tracking-wide">
                  {s.label}
                </span>
              </div>
              <div className="mt-1 text-sm font-semibold tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList>
            <TabsTrigger value="overview">Prehľad</TabsTrigger>
            <TabsTrigger value="design">Dizajn</TabsTrigger>
            <TabsTrigger value="structure">Štruktúra</TabsTrigger>
            <TabsTrigger value="pages">Stránky</TabsTrigger>
            <TabsTrigger value="assets">Assety</TabsTrigger>
            <TabsTrigger value="preview">Náhľad 1:1</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="size-4" />
                  Tech stack
                </CardTitle>
                <CardDescription>Signály z HTML, CSS a HTTP hlavičiek</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {blueprint.tech.length === 0 && (
                  <p className="text-sm text-fg-muted">Žiadne silné signály.</p>
                )}
                {blueprint.tech.map((t) => (
                  <div
                    key={t.name}
                    className="flex items-start justify-between gap-3 rounded-[var(--radius-sm)] border border-border bg-bg-subtle/60 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-fg-muted">{t.evidence}</div>
                    </div>
                    <Badge variant={confVariant(t.confidence)}>{t.confidence}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SEO & meta</CardTitle>
                <CardDescription>Title, description, Open Graph, ikony</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <MetaRow label="Description" value={blueprint.meta.description || "—"} />
                <MetaRow label="Language" value={blueprint.meta.language || "—"} />
                <MetaRow label="Canonical" value={blueprint.meta.canonical || "—"} mono />
                <MetaRow label="Theme" value={blueprint.meta.themeColor || "—"} />
                <MetaRow
                  label="Options"
                  value={
                    blueprint.options
                      ? `pages=${blueprint.options.maxPages}, render=${blueprint.options.render}, wayback=${blueprint.options.wayback}, assets=${blueprint.options.captureAssets}`
                      : "—"
                  }
                />
                <div className="flex items-center gap-2 text-xs text-fg-muted">
                  <Hash className="size-3.5" />
                  <span className="mono break-all">{blueprint.contentHash}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Obmedzenia</CardTitle>
              <CardDescription>Frontend snapshot — nie klon servera/DB</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-fg-muted">
                {(blueprint.limitations || []).map((l) => (
                  <li key={l} className="flex gap-2">
                    <span className="text-fg-subtle">–</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="size-4" />
                Farby
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {blueprint.design.colors.slice(0, 36).map((c) => (
                  <div
                    key={c}
                    className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-bg-subtle px-2 py-1.5"
                    title={c}
                  >
                    <span
                      className="size-5 rounded-[var(--radius-xs)] border border-border-strong shrink-0"
                      style={{ background: c }}
                    />
                    <span className="mono text-[11px] text-fg-muted max-w-[120px] truncate">
                      {c}
                    </span>
                  </div>
                ))}
                {blueprint.design.colors.length === 0 && (
                  <p className="text-sm text-fg-muted">Žiadne farby v CSS/HTML.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fonty</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {blueprint.design.fonts.length === 0 && (
                  <p className="text-sm text-fg-muted">—</p>
                )}
                {blueprint.design.fonts.map((f) => (
                  <Badge key={f} variant="default">
                    {f}
                  </Badge>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>CSS premenné</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-1 pr-3">
                    {Object.entries(blueprint.design.cssVariables)
                      .slice(0, 40)
                      .map(([k, v]) => (
                        <div
                          key={k}
                          className="flex gap-2 text-xs mono border-b border-border/60 py-1"
                        >
                          <span className="text-info shrink-0">{k}</span>
                          <span className="text-fg-muted truncate">{v}</span>
                        </div>
                      ))}
                    {Object.keys(blueprint.design.cssVariables).length === 0 && (
                      <p className="text-sm text-fg-muted">Žiadne custom properties.</p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="structure" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>DOM outline</CardTitle>
                <CardDescription>Skrátený strom (max hĺbka 5)</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-72">
                  <div className="pr-3">
                    {blueprint.outline.map((n, i) => (
                      <OutlineTree key={i} node={n} />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Nadpisy</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-72">
                  <div className="space-y-1.5 pr-3">
                    {blueprint.headings.map((h, i) => (
                      <div
                        key={`${h.level}-${i}`}
                        className="flex gap-2 text-sm"
                        style={{ paddingLeft: (h.level - 1) * 12 }}
                      >
                        <span className="mono text-xs text-fg-subtle shrink-0">
                          H{h.level}
                        </span>
                        <span className="text-fg-muted">{h.text}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Odkazy</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-56">
                <div className="space-y-1 pr-3">
                  {blueprint.links.slice(0, 80).map((l) => (
                    <div
                      key={l.href}
                      className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 border-b border-border/50 py-1.5 text-xs"
                    >
                      <Badge variant={l.internal ? "info" : "default"} className="w-fit">
                        {l.internal ? "int" : "ext"}
                      </Badge>
                      <span className="mono text-fg-muted break-all flex-1">{l.href}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {blueprint.forms.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Formuláre</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {blueprint.forms.map((f, i) => (
                  <div
                    key={i}
                    className="rounded-[var(--radius-md)] border border-border bg-bg-subtle/50 p-3"
                  >
                    <div className="flex flex-wrap gap-2 text-xs mono">
                      <Badge>{f.method}</Badge>
                      <span className="text-fg-muted break-all">{f.action}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.fields.map((field) => (
                        <Badge key={field.name} variant="default">
                          {field.name}
                          <span className="text-fg-subtle">:{field.type}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pages">
          <Card>
            <CardHeader>
              <CardTitle>Crawl mapa ({(pages.length || 0) + 1})</CardTitle>
              <CardDescription>Primárna stránka + same-origin crawl</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-[var(--radius-md)] border border-border bg-bg-subtle/50 px-3 py-2.5 text-sm">
                <div className="font-medium">Primary</div>
                <div className="mono text-xs text-fg-muted break-all">
                  {blueprint.finalUrl || blueprint.sourceUrl || "—"}
                </div>
                <div className="text-xs text-fg-subtle mt-1">
                  {blueprint.meta.title} · {formatBytes(blueprint.stats.htmlBytes)}
                </div>
              </div>
              {pages.length === 0 && (
                <p className="text-sm text-fg-muted">
                  Crawl nebol spustený (max pages = 1) alebo neboli interné odkazy.
                </p>
              )}
              {pages.map((p) => (
                <div
                  key={p.url}
                  className="rounded-[var(--radius-md)] border border-border px-3 py-2.5 text-sm"
                >
                  <div className="font-medium">{p.title || "(bez title)"}</div>
                  <div className="mono text-xs text-fg-muted break-all">{p.url}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-fg-subtle">
                    <span>HTTP {p.statusCode ?? "—"}</span>
                    <span>{formatBytes(p.htmlBytes)}</span>
                    <span>{p.internalLinkCount} int. odkazov</span>
                    <span>{p.formCount} formulárov</span>
                    <span className="mono">{p.contentHash.slice(0, 10)}…</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle>
                Assety ({blueprint.assets.length}) · captured {capturedCount}
              </CardTitle>
              <CardDescription>
                Captured súbory idú do ZIP pod assets/
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[420px]">
                <div className="space-y-1 pr-3">
                  {blueprint.assets.map((a) => (
                    <div
                      key={a.url}
                      className="flex items-start gap-2 border-b border-border/50 py-1.5 text-xs"
                    >
                      <Badge variant="default" className="shrink-0 capitalize">
                        {a.type}
                      </Badge>
                      {a.captured && (
                        <Badge variant="success" className="shrink-0">
                          zip
                        </Badge>
                      )}
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mono text-fg-muted break-all hover:text-fg"
                      >
                        {a.url}
                      </a>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="size-4" />
                Náhľad zachyteného frontendu
              </CardTitle>
              <CardDescription>
                Sandbox iframe s HTML + CSS. Externé assety podľa CORS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-white">
                <iframe
                  title="Blueprint preview"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  srcDoc={previewSrc}
                  className="h-[70vh] min-h-[420px] w-full bg-white"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="json">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle>Blueprint JSON</CardTitle>
                <CardDescription>Kompletný exportovateľný dokument</CardDescription>
              </div>
              <Button variant="secondary" size="sm" onClick={downloadJson}>
                <Download className="size-3.5" />
                Stiahnuť
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[480px] rounded-[var(--radius-md)] border border-border bg-bg">
                <pre className="p-4 text-[11px] leading-relaxed mono text-fg-muted whitespace-pre-wrap break-all">
                  {exportBlueprintJson({
                    ...blueprint,
                    html:
                      blueprint.html.length > 8000
                        ? `${blueprint.html.slice(0, 8000)}\n/* …truncated for display… */`
                        : blueprint.html,
                    cssBundles: blueprint.cssBundles.map((b) => ({
                      ...b,
                      css:
                        b.css.length > 2000
                          ? `${b.css.slice(0, 2000)}\n/* …truncated… */`
                          : b.css,
                    })),
                    assets: blueprint.assets.map(({ base64, ...rest }) =>
                      base64
                        ? { ...rest, base64: `[${base64.length} chars base64]` }
                        : rest,
                    ),
                  })}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
        {label}
      </span>
      <span className={cn("text-fg-muted break-words", mono && "mono text-xs")}>
        {value}
      </span>
    </div>
  );
}
