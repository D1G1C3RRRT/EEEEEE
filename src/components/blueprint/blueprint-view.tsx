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
  Blocks,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  downloadText,
  downloadElementorTemplate,
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

  function downloadElementor() {
    try {
      const tpl = downloadElementorTemplate(blueprint);
      toast.success(
        `Elementor template: ${tpl._blueprint?.widgetCount ?? "?"} widgetov`,
      );
    } catch {
      toast.error("Elementor export zlyhal");
    }
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
              {blueprint.wordpress?.detected && (
                <Badge variant="success">
                  <Blocks className="size-3 mr-1" />
                  WP/Jet
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
            <Button variant="secondary" size="sm" onClick={downloadElementor}>
              <LayoutGrid className="size-3.5" />
              Elementor JSON
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
            <TabsTrigger value="wordpress">WP / JetEngine</TabsTrigger>
            <TabsTrigger value="elementor">Elementor JSON</TabsTrigger>
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
                      ? `pages=${blueprint.options.maxPages}, render=${blueprint.options.render}, wayback=${blueprint.options.wayback}, assets=${blueprint.options.captureAssets}, wp=${blueprint.options.wpJetEngine ?? false}`
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

        <TabsContent value="wordpress" className="space-y-4">
          {!blueprint.wordpress ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Blocks className="size-4" />
                  WP / JetEngine
                </CardTitle>
                <CardDescription>
                  Zapni „WP / JetEngine clone“ pri skene URL pre REST + listing + Elementor extract.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "WordPress",
                    on: blueprint.wordpress.isWordPress,
                  },
                  {
                    label: "JetEngine",
                    on: blueprint.wordpress.isJetEngine,
                  },
                  {
                    label: "Elementor",
                    on: blueprint.wordpress.isElementor,
                  },
                  {
                    label: "Detected",
                    on: blueprint.wordpress.detected,
                  },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="rounded-[var(--radius-md)] border border-border bg-bg-subtle/80 px-3 py-2.5"
                  >
                    <div className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle">
                      {f.label}
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {f.on ? "áno" : "nie"}
                    </div>
                  </div>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>REST API discovery</CardTitle>
                  <CardDescription>
                    /wp-json · pages · jet-cct — verejné endpointy
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    blueprint.wordpress.rest.root,
                    blueprint.wordpress.rest.pages,
                    blueprint.wordpress.rest.posts,
                    blueprint.wordpress.rest.jetCctIndex,
                    ...blueprint.wordpress.rest.otherEndpoints,
                  ]
                    .filter(Boolean)
                    .map((ep) => (
                      <div
                        key={ep!.path}
                        className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-border bg-bg-subtle/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-medium mono text-xs break-all">
                            {ep!.path}
                          </div>
                          <div className="text-xs text-fg-muted">{ep!.summary}</div>
                        </div>
                        <Badge variant={ep!.ok ? "success" : "danger"}>
                          {ep!.status ?? "—"}
                        </Badge>
                      </div>
                    ))}
                  {blueprint.wordpress.rest.namespaces.length > 0 && (
                    <p className="text-xs text-fg-muted pt-1">
                      Namespaces:{" "}
                      {blueprint.wordpress.rest.namespaces.slice(0, 12).join(", ")}
                      {blueprint.wordpress.rest.namespaces.length > 12
                        ? "…"
                        : ""}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>JetEngine CCT typy</CardTitle>
                  <CardDescription>
                    Schéma polí odvodená z verejných záznamov
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {blueprint.wordpress.cctTypes.length === 0 && (
                    <p className="text-sm text-fg-muted">
                      Žiadne verejné CCT typy (endpoint nedostupný alebo prázdny).
                    </p>
                  )}
                  {blueprint.wordpress.cctTypes.map((cct) => (
                    <div
                      key={cct.slug}
                      className="rounded-[var(--radius-sm)] border border-border bg-bg-subtle/60 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{cct.slug}</span>
                        <Badge variant="default">{cct.endpoint}</Badge>
                        {cct.itemCount != null && (
                          <Badge variant="info">{cct.itemCount} items</Badge>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {cct.fields.slice(0, 24).map((f) => (
                          <span
                            key={f.name}
                            className="rounded-full border border-border bg-bg px-2 py-0.5 text-[11px] mono text-fg-muted"
                          >
                            {f.name}
                            {f.type ? `:${f.type}` : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutGrid className="size-4" />
                    Jet listing grids
                  </CardTitle>
                  <CardDescription>
                    DOM reverse-engineering opakovaných item templateov + dynamic fields
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {blueprint.wordpress.listingGrids.length === 0 && (
                    <p className="text-sm text-fg-muted">Žiadne jet-listing-grid v DOM.</p>
                  )}
                  {blueprint.wordpress.listingGrids.map((g, i) => (
                    <div
                      key={`${g.id}-${i}`}
                      className="rounded-[var(--radius-sm)] border border-border bg-bg-subtle/60 px-3 py-2 text-sm"
                    >
                      <div className="font-medium">
                        {g.id || `grid-${i + 1}`}
                        {g.listingId ? (
                          <span className="text-fg-muted"> · listing {g.listingId}</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-fg-muted mt-0.5">
                        items={g.itemCount}
                        {g.postType ? ` · post_type=${g.postType}` : ""}
                        {g.dynamicFields?.length
                          ? ` · ${g.dynamicFields.length} dyn. fields`
                          : ""}
                      </div>
                      {g.itemTemplate && (
                        <div className="mt-2 space-y-1 text-xs">
                          <p className="text-fg-muted">
                            Sample: {g.itemTemplate.textSample || "—"}
                          </p>
                          {g.itemTemplate.typographyHints.slice(0, 4).map((t) => (
                            <div key={t} className="mono text-fg-subtle truncate">
                              {t}
                            </div>
                          ))}
                          {(g.itemTemplate.dynamicFields || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {g.itemTemplate.dynamicFields.slice(0, 12).map((f, fi) => (
                                <Badge key={`${f.key}-${fi}`} variant="info">
                                  {f.kind}:{f.key}
                                  {f.metaKey ? `=${f.metaKey}` : ""}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FormInput className="size-4" />
                    JetEngine dynamic fields
                  </CardTitle>
                  <CardDescription>
                    field · link · image · terms · meta — z DOM + data-settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(blueprint.wordpress.dynamicFieldCatalog || []).length === 0 &&
                    (blueprint.wordpress.dynamicFields || []).length === 0 && (
                      <p className="text-sm text-fg-muted">
                        Žiadne jet-listing-dynamic-* v DOM.
                      </p>
                    )}
                  {(blueprint.wordpress.dynamicFieldCatalog || []).length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-wide text-fg-subtle">
                        Katalóg ({blueprint.wordpress.dynamicFieldCatalog.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {blueprint.wordpress.dynamicFieldCatalog.map((c) => (
                          <span
                            key={`${c.kind}:${c.key}`}
                            className="rounded-full border border-border bg-bg px-2 py-0.5 text-[11px] mono text-fg-muted"
                            title={c.sampleValues.join(" · ")}
                          >
                            <span className="text-info">{c.kind}</span>:{c.key}
                            {c.metaKey ? (
                              <span className="text-fg-subtle"> meta={c.metaKey}</span>
                            ) : null}
                            <span className="text-fg-subtle"> ×{c.occurrences}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <ScrollArea className="h-48">
                    <div className="space-y-2 pr-3">
                      {(blueprint.wordpress.dynamicFields || []).slice(0, 40).map((f, i) => (
                        <div
                          key={`${f.key}-${i}`}
                          className="rounded-[var(--radius-sm)] border border-border/70 bg-bg px-2.5 py-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="accent">{f.kind}</Badge>
                            <span className="font-medium mono">{f.key}</span>
                            <Badge variant="default">{f.source}</Badge>
                            <Badge variant={confVariant(f.confidence)}>{f.confidence}</Badge>
                            <span className="text-fg-subtle">{f.context}</span>
                          </div>
                          <div className="mt-1 text-fg-muted">
                            {f.sampleValue || f.sampleUrl || "—"}
                          </div>
                          <div className="mt-0.5 mono text-[10px] text-fg-subtle">
                            {f.evidence}
                            {f.formatHints?.length
                              ? ` · ${f.formatHints.slice(0, 3).join(", ")}`
                              : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Elementor sekcie</CardTitle>
                  <CardDescription>data-id · role · headings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {blueprint.wordpress.elementorSections.length === 0 && (
                    <p className="text-sm text-fg-muted">Žiadne Elementor sekcie.</p>
                  )}
                  {blueprint.wordpress.elementorSections.slice(0, 20).map((s, i) => (
                    <div
                      key={`${s.dataId}-${i}`}
                      className="flex flex-wrap items-start justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-bg-subtle/60 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium mono text-xs">
                          {s.dataId || "no-id"}
                          {s.elementorType ? ` · ${s.elementorType}` : ""}
                        </div>
                        <div className="text-xs text-fg-muted truncate max-w-[420px]">
                          {s.headings.join(" · ") || s.classes.slice(0, 3).join(" ")}
                        </div>
                      </div>
                      <Badge variant="default">{s.role}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Crawl seed (nav / footer / sitemap)</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div>
                    <div className="font-medium mb-1">Nav ({blueprint.wordpress.navLinks.length})</div>
                    <ul className="space-y-0.5 text-fg-muted mono break-all">
                      {blueprint.wordpress.navLinks.slice(0, 8).map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium mb-1">
                      Footer ({blueprint.wordpress.footerLinks.length})
                    </div>
                    <ul className="space-y-0.5 text-fg-muted mono break-all">
                      {blueprint.wordpress.footerLinks.slice(0, 8).map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium mb-1">
                      Sitemap ({blueprint.wordpress.sitemapUrls.length})
                    </div>
                    <ul className="space-y-0.5 text-fg-muted mono break-all">
                      {blueprint.wordpress.sitemapUrls.slice(0, 8).map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="elementor" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutGrid className="size-4" />
                Elementor DOM → Template Compiler
              </CardTitle>
              <CardDescription>
                Import: Šablóny → Uložené šablóny → Importovať šablóny →{" "}
                <span className="mono">elementor-template-import.json</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {blueprint.elementorTemplate ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-[var(--radius-md)] border border-border bg-bg-subtle/80 px-3 py-2">
                      <div className="text-[11px] uppercase text-fg-subtle">Widgets</div>
                      <div className="font-semibold tabular-nums">
                        {blueprint.elementorTemplate._blueprint?.widgetCount ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-border bg-bg-subtle/80 px-3 py-2">
                      <div className="text-[11px] uppercase text-fg-subtle">Nodes</div>
                      <div className="font-semibold tabular-nums">
                        {blueprint.elementorTemplate._blueprint?.nodeCount ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-border bg-bg-subtle/80 px-3 py-2">
                      <div className="text-[11px] uppercase text-fg-subtle">Top</div>
                      <div className="font-semibold tabular-nums">
                        {blueprint.elementorTemplate.content.length}
                      </div>
                    </div>
                    <div className="rounded-[var(--radius-md)] border border-border bg-bg-subtle/80 px-3 py-2">
                      <div className="text-[11px] uppercase text-fg-subtle">Version</div>
                      <div className="font-semibold">
                        {blueprint.elementorTemplate.version}
                      </div>
                    </div>
                  </div>
                  <ul className="text-xs text-fg-muted space-y-1">
                    {(blueprint.elementorTemplate._blueprint?.notes || []).map((n) => (
                      <li key={n}>– {n}</li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={downloadElementor}>
                      <Download className="size-3.5" />
                      Stiahnuť elementor-template-import.json
                    </Button>
                  </div>
                  <ScrollArea className="h-72 rounded-[var(--radius-md)] border border-border">
                    <pre className="p-3 text-[11px] mono text-fg-muted whitespace-pre-wrap break-all">
                      {JSON.stringify(
                        {
                          version: blueprint.elementorTemplate.version,
                          title: blueprint.elementorTemplate.title,
                          type: blueprint.elementorTemplate.type,
                          content: blueprint.elementorTemplate.content.slice(0, 3),
                          page_settings: blueprint.elementorTemplate.page_settings,
                          _truncated:
                            blueprint.elementorTemplate.content.length > 3
                              ? `+${blueprint.elementorTemplate.content.length - 3} top nodes`
                              : undefined,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </ScrollArea>
                </>
              ) : (
                <p className="text-sm text-fg-muted">
                  Template ešte nie je skompilovaný. Spusti nový sken.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="design" className="space-y-4">
          {blueprint.design.elementorGlobals &&
            Object.keys(blueprint.design.elementorGlobals.colors).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="size-4" />
                    Elementor global colors
                  </CardTitle>
                  <CardDescription>
                    --e-global-color-* z{" "}
                    <span className="mono">elementor-frontend-inline-css</span>
                    {blueprint.design.elementorGlobals.styleIds.length
                      ? ` (${blueprint.design.elementorGlobals.styleIds.join(", ")})`
                      : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(blueprint.design.elementorGlobals.colors)
                      .slice(0, 40)
                      .map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-bg-subtle px-2 py-1.5"
                          title={`${k}: ${v}`}
                        >
                          <span
                            className="size-5 rounded-[var(--radius-xs)] border border-border-strong shrink-0"
                            style={{ background: v }}
                          />
                          <div className="min-w-0">
                            <div className="mono text-[10px] text-fg-subtle truncate max-w-[140px]">
                              {k.replace("--e-global-color-", "")}
                            </div>
                            <div className="mono text-[11px] text-fg-muted truncate max-w-[140px]">
                              {v}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}

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

          {blueprint.design.typography && blueprint.design.typography.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Typografia (h1–h4, body, button)</CardTitle>
                <CardDescription>
                  font-family · size · weight · line-height · letter-spacing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-fg-subtle border-b border-border">
                        <th className="py-1.5 pr-2 font-medium">Sel</th>
                        <th className="py-1.5 pr-2 font-medium">Family</th>
                        <th className="py-1.5 pr-2 font-medium">Size</th>
                        <th className="py-1.5 pr-2 font-medium">Weight</th>
                        <th className="py-1.5 pr-2 font-medium">LH</th>
                        <th className="py-1.5 pr-2 font-medium">LS</th>
                        <th className="py-1.5 font-medium">Src</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blueprint.design.typography.map((t) => (
                        <tr key={t.selector} className="border-b border-border/50">
                          <td className="py-1.5 pr-2 mono font-medium">{t.selector}</td>
                          <td className="py-1.5 pr-2 mono text-fg-muted max-w-[120px] truncate">
                            {t.fontFamily || "—"}
                          </td>
                          <td className="py-1.5 pr-2 mono">{t.fontSize || "—"}</td>
                          <td className="py-1.5 pr-2 mono">{t.fontWeight || "—"}</td>
                          <td className="py-1.5 pr-2 mono">{t.lineHeight || "—"}</td>
                          <td className="py-1.5 pr-2 mono">{t.letterSpacing || "—"}</td>
                          <td className="py-1.5">
                            <Badge variant="default">{t.source}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

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
                <CardDescription>vrátane --e-global-*</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-1 pr-3">
                    {Object.entries(blueprint.design.cssVariables)
                      .slice(0, 60)
                      .map(([k, v]) => (
                        <div
                          key={k}
                          className="flex gap-2 text-xs mono border-b border-border/60 py-1"
                        >
                          <span
                            className={
                              k.startsWith("--e-global")
                                ? "text-warning shrink-0"
                                : "text-info shrink-0"
                            }
                          >
                            {k}
                          </span>
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

          {blueprint.design.fullImageUrls &&
            blueprint.design.fullImageUrls.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Full-size images (WP uploads)</CardTitle>
                  <CardDescription>
                    Thumbnail suffixy (-300x200, -1024x768…) odstránené
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-40">
                    <ul className="space-y-1 pr-3 text-xs mono text-fg-muted break-all">
                      {blueprint.design.fullImageUrls.slice(0, 40).map((u) => (
                        <li key={u}>{u}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
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
                <CardTitle className="flex items-center gap-2">
                  <FormInput className="size-4" />
                  Formuláre
                </CardTitle>
                <CardDescription>
                  login · lost password · contact · booking · auth…
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {blueprint.forms.map((f, i) => (
                  <div
                    key={i}
                    className="rounded-[var(--radius-md)] border border-border bg-bg-subtle/50 p-3"
                  >
                    <div className="flex flex-wrap gap-2 text-xs items-center">
                      <Badge variant="accent">{f.category || "other"}</Badge>
                      <Badge>{f.method}</Badge>
                      {f.confidence && (
                        <Badge variant={confVariant(f.confidence)}>{f.confidence}</Badge>
                      )}
                      {f.submitText && (
                        <span className="text-fg-muted">submit: {f.submitText}</span>
                      )}
                      <span className="mono text-fg-muted break-all flex-1">{f.action}</span>
                    </div>
                    {f.evidence && (
                      <p className="mt-1 text-[11px] text-fg-subtle">{f.evidence}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.fields.map((field) => (
                        <Badge key={`${field.name}-${field.type}`} variant="default">
                          {field.name}
                          <span className="text-fg-subtle">:{field.type}</span>
                          {field.required ? "*" : ""}
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
