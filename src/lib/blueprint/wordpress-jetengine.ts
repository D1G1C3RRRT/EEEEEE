import { parse, type HTMLElement } from "node-html-parser";
import { assertPublicUrl } from "./scan";

const FETCH_MS = 12_000;
const MAX_JSON_BYTES = 1_500_000;
const MAX_CCT_TYPES = 40;
const MAX_CCT_ITEMS = 50;
const MAX_PAGES_REST = 40;
const USER_AGENT =
  "BlueprintScanner/1.2 WP+JetEngine (+https://local; public architecture extract)";

export interface JetListingItemTemplate {
  outerHtml: string;
  classes: string[];
  links: string[];
  textSample: string;
  icons: string[];
  typographyHints: string[];
}

export interface JetListingGrid {
  id: string | null;
  classes: string[];
  listingId: string | null;
  postType: string | null;
  itemCount: number;
  itemTemplate: JetListingItemTemplate | null;
  settingsHints: Record<string, string>;
}

export interface ElementorSection {
  dataId: string | null;
  elementorType: string | null;
  classes: string[];
  role: "hero" | "content" | "grid" | "header" | "footer" | "section" | "unknown";
  headings: string[];
  childSummary: string[];
}

export interface WpRestEndpointResult {
  path: string;
  url: string;
  status: number | null;
  ok: boolean;
  bytes: number;
  summary: string;
  /** truncated raw payload for blueprint (stringified JSON or error) */
  payloadPreview: string;
  data?: unknown;
}

export interface JetCctType {
  slug: string;
  endpoint: string;
  itemCount: number | null;
  fields: Array<{ name: string; type?: string; required?: boolean }>;
  sampleItems: unknown[];
  schemaHints: Record<string, unknown>;
}

export interface WordPressArchitecture {
  detected: boolean;
  isWordPress: boolean;
  isJetEngine: boolean;
  isElementor: boolean;
  rest: {
    root: WpRestEndpointResult | null;
    namespaces: string[];
    pages: WpRestEndpointResult | null;
    posts: WpRestEndpointResult | null;
    jetCctIndex: WpRestEndpointResult | null;
    otherEndpoints: WpRestEndpointResult[];
  };
  cctTypes: JetCctType[];
  listingGrids: JetListingGrid[];
  elementorSections: ElementorSection[];
  sitemapUrls: string[];
  navLinks: string[];
  footerLinks: string[];
  notes: string[];
  limitations: string[];
}

function absUrl(base: string, href: string | null | undefined): string | null {
  if (!href) return null;
  const h = href.trim();
  if (!h || h.startsWith("data:") || h.startsWith("javascript:") || h.startsWith("#"))
    return null;
  try {
    return new URL(h, base).toString();
  } catch {
    return null;
  }
}

function textSample(el: HTMLElement, max = 160): string {
  const t = (el.text || "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

async function fetchJson(
  url: string,
): Promise<{ status: number; text: string; json: unknown | null; finalUrl: string }> {
  assertPublicUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json, */*;q=0.8",
        "accept-language": "en,sk;q=0.9",
      },
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    const sliced = buf.byteLength > MAX_JSON_BYTES ? buf.slice(0, MAX_JSON_BYTES) : buf;
    const text = new TextDecoder("utf-8", { fatal: false }).decode(sliced);
    let json: unknown | null = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, text, json, finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextPublic(url: string): Promise<{ status: number; text: string }> {
  assertPublicUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/xml,text/xml,text/html,*/*;q=0.8",
      },
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    const sliced = buf.byteLength > MAX_JSON_BYTES ? buf.slice(0, MAX_JSON_BYTES) : buf;
    const text = new TextDecoder("utf-8", { fatal: false }).decode(sliced);
    return { status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

function endpointResult(
  path: string,
  url: string,
  status: number | null,
  json: unknown | null,
  text: string,
  summary: string,
): WpRestEndpointResult {
  const ok = status != null && status >= 200 && status < 400 && json != null;
  const preview =
    text.length > 4000 ? `${text.slice(0, 4000)}…[truncated]` : text;
  return {
    path,
    url,
    status,
    ok,
    bytes: Buffer.byteLength(text, "utf8"),
    summary,
    payloadPreview: preview,
    ...(ok ? { data: truncateDeep(json, 3, 40) } : {}),
  };
}

/** Limit depth/keys so blueprint stays actionable, not a megabyte dump */
function truncateDeep(value: unknown, depth: number, maxKeys: number): unknown {
  if (depth <= 0) {
    if (Array.isArray(value)) return `[array:${value.length}]`;
    if (value && typeof value === "object") return "[object]";
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 12).map((v) => truncateDeep(v, depth - 1, maxKeys));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, maxKeys);
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      out[k] = truncateDeep(v, depth - 1, maxKeys);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 400) {
    return `${value.slice(0, 400)}…`;
  }
  return value;
}

function summarizeRoot(json: unknown): { summary: string; namespaces: string[] } {
  if (!json || typeof json !== "object") {
    return { summary: "neplatný JSON root", namespaces: [] };
  }
  const o = json as Record<string, unknown>;
  const ns = Array.isArray(o.namespaces)
    ? o.namespaces.filter((x): x is string => typeof x === "string")
    : [];
  const name = typeof o.name === "string" ? o.name : "WP REST";
  const desc = typeof o.description === "string" ? o.description : "";
  return {
    summary: `${name}${desc ? ` — ${desc.slice(0, 80)}` : ""}; namespaces: ${ns.length}`,
    namespaces: ns.slice(0, 40),
  };
}

function extractFieldsFromItem(item: unknown): JetCctType["fields"] {
  if (!item || typeof item !== "object") return [];
  const o = item as Record<string, unknown>;
  // JetEngine CCT items often nest meta under `meta` or use top-level keys
  const meta =
    o.meta && typeof o.meta === "object"
      ? (o.meta as Record<string, unknown>)
      : o;
  const skip = new Set([
    "id",
    "_ID",
    "cct_status",
    "cct_created",
    "cct_modified",
    "cct_author_id",
    "_links",
  ]);
  const fields: JetCctType["fields"] = [];
  for (const [name, val] of Object.entries(meta)) {
    if (skip.has(name) || name.startsWith("_")) continue;
    const type =
      typeof val === "number"
        ? "number"
        : typeof val === "boolean"
          ? "boolean"
          : Array.isArray(val)
            ? "array"
            : typeof val === "object" && val !== null
              ? "object"
              : "string";
    fields.push({ name, type });
    if (fields.length >= 60) break;
  }
  return fields;
}

function guessSectionRole(
  classes: string[],
  headings: string[],
  dataId: string | null,
): ElementorSection["role"] {
  const blob = `${classes.join(" ")} ${headings.join(" ")} ${dataId || ""}`.toLowerCase();
  if (/header|site-header|elementor-location-header/.test(blob)) return "header";
  if (/footer|site-footer|elementor-location-footer/.test(blob)) return "footer";
  if (/hero|banner|jumbotron|masthead/.test(blob)) return "hero";
  if (/grid|listing|cards|archive|loop/.test(blob)) return "grid";
  if (/content|main|article|entry/.test(blob)) return "content";
  if (headings.some((h) => h.length > 8) && classes.some((c) => /elementor-section/.test(c)))
    return "section";
  return "unknown";
}

export function extractJetListingGrids(html: string, base: string): JetListingGrid[] {
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: true, style: true, noscript: true },
  });
  const grids: JetListingGrid[] = [];
  const nodes = root.querySelectorAll(
    ".jet-listing-grid, [class*='jet-listing-grid--'], .jet-listing, .elementor-widget-jet-listing-grid",
  );

  for (const node of nodes) {
    const classAttr = node.getAttribute("class") || "";
    const classes = classAttr.split(/\s+/).filter(Boolean);
    const idClass = classes.find((c) => /^jet-listing-grid--\d+/.test(c));
    const listingId =
      node.getAttribute("data-listing-id") ||
      idClass?.replace("jet-listing-grid--", "") ||
      node.getAttribute("data-id") ||
      null;

    const settingsHints: Record<string, string> = {};
    for (const attr of [
      "data-widget-id",
      "data-id",
      "data-element_type",
      "data-settings",
      "data-post-id",
    ]) {
      const v = node.getAttribute(attr);
      if (v) settingsHints[attr] = v.slice(0, 500);
    }

    // post type hints from data-settings JSON
    let postType: string | null = null;
    const rawSettings = node.getAttribute("data-settings");
    if (rawSettings) {
      try {
        const s = JSON.parse(rawSettings.replace(/"/g, '"'));
        if (s && typeof s === "object") {
          postType =
            (s.post_type as string) ||
            (s.lisitng_post_type as string) ||
            (s.listing_post_type as string) ||
            null;
        }
      } catch {
        /* ignore */
      }
    }

    const items = node.querySelectorAll(
      ".jet-listing-grid__item, .jet-listing-dynamic-post, .jet-engine-listing-overlay-wrap, article",
    );
    let itemTemplate: JetListingItemTemplate | null = null;
    const first = items[0];
    if (first) {
      const itemClasses = (first.getAttribute("class") || "").split(/\s+/).filter(Boolean);
      const links = first
        .querySelectorAll("a[href]")
        .map((a) => absUrl(base, a.getAttribute("href")))
        .filter((u): u is string => Boolean(u))
        .slice(0, 12);
      const icons = first
        .querySelectorAll("i[class], svg, .elementor-icon")
        .map((el) => el.getAttribute("class") || el.tagName.toLowerCase())
        .filter(Boolean)
        .slice(0, 12);
      const typographyHints: string[] = [];
      for (const el of first.querySelectorAll(
        "h1,h2,h3,h4,h5,h6,p,.elementor-heading-title,.jet-listing-dynamic-field",
      )) {
        const cls = el.getAttribute("class") || "";
        const tag = el.tagName.toLowerCase();
        typographyHints.push(
          `${tag}${cls ? `.${cls.split(/\s+/).slice(0, 3).join(".")}` : ""}: ${textSample(el, 60)}`,
        );
        if (typographyHints.length >= 10) break;
      }
      const outer = first.toString().slice(0, 2500);
      itemTemplate = {
        outerHtml: outer,
        classes: itemClasses.slice(0, 20),
        links,
        textSample: textSample(first, 200),
        icons,
        typographyHints,
      };
    }

    grids.push({
      id: node.getAttribute("id") || idClass || listingId,
      classes: classes.slice(0, 24),
      listingId,
      postType,
      itemCount: items.length,
      itemTemplate,
      settingsHints,
    });
    if (grids.length >= 30) break;
  }
  return grids;
}

export function extractElementorSections(html: string): ElementorSection[] {
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: true, style: true, noscript: true },
  });
  const sections: ElementorSection[] = [];
  const nodes = root.querySelectorAll(
    "[data-elementor-type], .elementor-section, .elementor-top-section, [data-id].elementor-element",
  );

  const seen = new Set<string>();
  for (const node of nodes) {
    const dataId = node.getAttribute("data-id") || null;
    const elementorType =
      node.getAttribute("data-elementor-type") ||
      node.getAttribute("data-element_type") ||
      null;
    const classes = (node.getAttribute("class") || "").split(/\s+/).filter(Boolean);
    // prefer top-level sections / containers
    if (
      !elementorType &&
      !classes.some((c) =>
        /elementor-section|elementor-top-section|e-con-full|e-parent/.test(c),
      )
    ) {
      continue;
    }
    const key = dataId || classes.slice(0, 4).join(".");
    if (seen.has(key)) continue;
    seen.add(key);

    const headings = node
      .querySelectorAll("h1,h2,h3,.elementor-heading-title")
      .map((h) => textSample(h, 80))
      .filter(Boolean)
      .slice(0, 8);
    const childSummary: string[] = [];
    for (const ch of node.childNodes) {
      if ((ch as HTMLElement).nodeType !== 1) continue;
      const el = ch as HTMLElement;
      const tag = el.tagName?.toLowerCase?.() || "";
      if (!tag) continue;
      const c = (el.getAttribute("class") || "").split(/\s+/).slice(0, 3).join(".");
      childSummary.push(c ? `${tag}.${c}` : tag);
      if (childSummary.length >= 12) break;
    }

    sections.push({
      dataId,
      elementorType,
      classes: classes.slice(0, 16),
      role: guessSectionRole(classes, headings, dataId),
      headings,
      childSummary,
    });
    if (sections.length >= 40) break;
  }
  return sections;
}

export function extractNavFooterLinks(html: string, base: string): {
  navLinks: string[];
  footerLinks: string[];
} {
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: true, style: true, noscript: true },
  });
  const collect = (sel: string, limit: number) => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const scope of root.querySelectorAll(sel)) {
      for (const a of scope.querySelectorAll("a[href]")) {
        const u = absUrl(base, a.getAttribute("href"));
        if (!u || seen.has(u)) continue;
        seen.add(u);
        out.push(u);
        if (out.length >= limit) return out;
      }
    }
    return out;
  };
  return {
    navLinks: collect(
      "header, nav, .site-header, .elementor-location-header, #site-navigation, .main-navigation",
      80,
    ),
    footerLinks: collect(
      "footer, .site-footer, .elementor-location-footer, #colophon",
      80,
    ),
  };
}

export async function fetchSitemapUrls(origin: string): Promise<string[]> {
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/wp-sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
  ];
  const urls: string[] = [];
  const seen = new Set<string>();

  const pushLocs = (xml: string) => {
    const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) && urls.length < 200) {
      try {
        const u = new URL(m[1].trim()).toString();
        if (seen.has(u)) continue;
        seen.add(u);
        urls.push(u);
      } catch {
        /* skip */
      }
    }
  };

  for (const sm of candidates) {
    try {
      const res = await fetchTextPublic(sm);
      if (res.status < 200 || res.status >= 400) continue;
      pushLocs(res.text);
      // follow sitemap index children (limited)
      const childMaps = [...res.text.matchAll(/<loc>\s*([^<\s]+\.xml[^<\s]*)\s*<\/loc>/gi)]
        .map((x) => x[1])
        .slice(0, 8);
      for (const child of childMaps) {
        try {
          const c = await fetchTextPublic(child);
          if (c.status >= 200 && c.status < 400) pushLocs(c.text);
        } catch {
          /* skip */
        }
      }
      if (urls.length) break;
    } catch {
      /* try next */
    }
  }
  return urls;
}

function detectWpFromHtml(html: string, headers: Record<string, string>): {
  isWordPress: boolean;
  isJetEngine: boolean;
  isElementor: boolean;
} {
  const isWordPress =
    /wp-content|wp-includes|wp-json|wordpress/i.test(html) ||
    /wordpress/i.test(headers["x-powered-by"] || "") ||
    Boolean(headers["link"]?.includes("wp-json"));
  const isJetEngine =
    /jet-engine|jet-listing|jet-cct|jet-smart-filters|JetEngine/i.test(html);
  const isElementor =
    /elementor|data-elementor-type|elementor-widget/i.test(html);
  return { isWordPress, isJetEngine, isElementor };
}

export async function extractWordPressArchitecture(opts: {
  baseUrl: string;
  html: string;
  headers?: Record<string, string>;
  deep?: boolean;
}): Promise<WordPressArchitecture> {
  const notes: string[] = [];
  const limitations = [
    "WP/JetEngine extract je len z verejných REST endpointov a DOM — nie wp-admin, privátne CCT ani DB.",
    "CCT schémy sú odvodené z verejných záznamov / indexu; skryté polia nemusia byť vo výstupe.",
    "Elementor template JSON (postmeta) bez REST/exportu nie je dostupný 1:1.",
  ];

  let origin: string;
  try {
    origin = new URL(opts.baseUrl).origin;
  } catch {
    return emptyArchitecture("Neplatná base URL pre WP extract.");
  }

  const flags = detectWpFromHtml(opts.html, opts.headers || {});
  const listingGrids = extractJetListingGrids(opts.html, opts.baseUrl);
  const elementorSections = extractElementorSections(opts.html);
  const { navLinks, footerLinks } = extractNavFooterLinks(opts.html, opts.baseUrl);

  const rest = {
    root: null as WpRestEndpointResult | null,
    namespaces: [] as string[],
    pages: null as WpRestEndpointResult | null,
    posts: null as WpRestEndpointResult | null,
    jetCctIndex: null as WpRestEndpointResult | null,
    otherEndpoints: [] as WpRestEndpointResult[],
  };
  const cctTypes: JetCctType[] = [];

  // 1) REST discovery
  try {
    const rootUrl = `${origin}/wp-json/`;
    const rootRes = await fetchJson(rootUrl);
    const { summary, namespaces } = summarizeRoot(rootRes.json);
    rest.root = endpointResult(
      "/wp-json/",
      rootUrl,
      rootRes.status,
      rootRes.json,
      rootRes.text,
      summary,
    );
    rest.namespaces = namespaces;
    if (rest.root.ok) {
      notes.push(`WP REST root OK (${namespaces.length} namespaces).`);
      flags.isWordPress = true;
    }
  } catch (e) {
    notes.push(
      `WP REST root nedostupný: ${e instanceof Error ? e.message : "error"}`,
    );
  }

  // pages + posts
  for (const path of ["/wp-json/wp/v2/pages?per_page=20", "/wp-json/wp/v2/posts?per_page=10"] as const) {
    try {
      const url = `${origin}${path}`;
      const res = await fetchJson(url);
      const count = Array.isArray(res.json) ? res.json.length : 0;
      const result = endpointResult(
        path.split("?")[0],
        url,
        res.status,
        res.json,
        res.text,
        Array.isArray(res.json)
          ? `${count} záznamov`
          : res.json
            ? "JSON objekt"
            : "bez JSON",
      );
      if (path.includes("/pages")) rest.pages = result;
      else rest.posts = result;
      if (result.ok) flags.isWordPress = true;
    } catch {
      /* skip */
    }
  }

  // jet-cct index + types
  const jetPaths = [
    "/wp-json/jet-cct/",
    "/wp-json/jet-engine/v2/",
    "/wp-json/jet-engine/",
  ];
  for (const path of jetPaths) {
    try {
      const url = `${origin}${path}`;
      const res = await fetchJson(url);
      const result = endpointResult(
        path,
        url,
        res.status,
        res.json,
        res.text,
        res.json ? "Jet endpoint odpoveď" : "bez JSON",
      );
      if (path === "/wp-json/jet-cct/") {
        rest.jetCctIndex = result;
        if (result.ok) {
          flags.isJetEngine = true;
          notes.push("JetEngine CCT index nájdený.");
          // Discover CCT type routes from root routes or namespaces
          const routes =
            res.json &&
            typeof res.json === "object" &&
            (res.json as { routes?: Record<string, unknown> }).routes
              ? Object.keys((res.json as { routes: Record<string, unknown> }).routes)
              : [];
          const cctSlugs = new Set<string>();
          for (const r of routes) {
            const m = r.match(/\/jet-cct\/([a-zA-Z0-9_-]+)/);
            if (m) cctSlugs.add(m[1]);
          }
          // also try namespaces list from root
          for (const ns of rest.namespaces) {
            const m = ns.match(/^jet-cct\/([a-zA-Z0-9_-]+)/);
            if (m) cctSlugs.add(m[1]);
          }
          // If routes empty, try common listing via HTML markers
          if (cctSlugs.size === 0) {
            const htmlCct = opts.html.matchAll(/jet-cct[_/]([a-zA-Z0-9_-]+)/gi);
            for (const m of htmlCct) cctSlugs.add(m[1]);
          }

          let i = 0;
          for (const slug of cctSlugs) {
            if (i++ >= MAX_CCT_TYPES) break;
            if (slug === "jet-cct" || slug === "v1" || slug === "v2") continue;
            try {
              const cctUrl = `${origin}/wp-json/jet-cct/${slug}?per_page=${MAX_CCT_ITEMS}`;
              const cctRes = await fetchJson(cctUrl);
              if (cctRes.status >= 200 && cctRes.status < 400 && Array.isArray(cctRes.json)) {
                const items = cctRes.json as unknown[];
                const fields = items[0] ? extractFieldsFromItem(items[0]) : [];
                cctTypes.push({
                  slug,
                  endpoint: `/wp-json/jet-cct/${slug}`,
                  itemCount: items.length,
                  fields,
                  sampleItems: items
                    .slice(0, 3)
                    .map((it) => truncateDeep(it, 2, 30)),
                  schemaHints: {
                    source: "inferred-from-public-items",
                    fieldCount: fields.length,
                  },
                });
              } else if (
                cctRes.status >= 200 &&
                cctRes.status < 400 &&
                cctRes.json &&
                typeof cctRes.json === "object"
              ) {
                cctTypes.push({
                  slug,
                  endpoint: `/wp-json/jet-cct/${slug}`,
                  itemCount: null,
                  fields: extractFieldsFromItem(cctRes.json),
                  sampleItems: [truncateDeep(cctRes.json, 2, 30)],
                  schemaHints: { source: "object-response" },
                });
              }
            } catch {
              /* skip type */
            }
          }
        }
      } else if (result.ok) {
        rest.otherEndpoints.push(result);
        flags.isJetEngine = true;
      }
    } catch {
      /* skip */
    }
  }

  // Extra: if namespaces include jet-cct/* discover types
  if (cctTypes.length === 0 && rest.namespaces.some((n) => n.startsWith("jet-cct"))) {
    flags.isJetEngine = true;
  }

  // Sitemap
  let sitemapUrls: string[] = [];
  if (opts.deep !== false) {
    try {
      sitemapUrls = await fetchSitemapUrls(origin);
      if (sitemapUrls.length) {
        notes.push(`Sitemap: ${sitemapUrls.length} URL.`);
      }
    } catch {
      notes.push("Sitemap nedostupná alebo prázdna.");
    }
  }

  if (listingGrids.length) {
    notes.push(`Jet listing grids v DOM: ${listingGrids.length}.`);
    flags.isJetEngine = true;
  }
  if (elementorSections.length) {
    notes.push(`Elementor sekcie: ${elementorSections.length}.`);
    flags.isElementor = true;
  }

  const detected =
    flags.isWordPress ||
    flags.isJetEngine ||
    flags.isElementor ||
    listingGrids.length > 0 ||
    Boolean(rest.root?.ok);

  return {
    detected,
    isWordPress: flags.isWordPress,
    isJetEngine: flags.isJetEngine,
    isElementor: flags.isElementor,
    rest,
    cctTypes,
    listingGrids,
    elementorSections,
    sitemapUrls: sitemapUrls.slice(0, 200),
    navLinks,
    footerLinks,
    notes,
    limitations,
  };
}

function emptyArchitecture(note: string): WordPressArchitecture {
  return {
    detected: false,
    isWordPress: false,
    isJetEngine: false,
    isElementor: false,
    rest: {
      root: null,
      namespaces: [],
      pages: null,
      posts: null,
      jetCctIndex: null,
      otherEndpoints: [],
    },
    cctTypes: [],
    listingGrids: [],
    elementorSections: [],
    sitemapUrls: [],
    navLinks: [],
    footerLinks: [],
    notes: [note],
    limitations: [
      "WP/JetEngine extract je len z verejných REST endpointov a DOM — nie wp-admin, privátne CCT ani DB.",
    ],
  };
}
