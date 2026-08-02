/**
 * SPA-Aware UI Architecture Compiler prompt builder.
 * Produces the high-signal REVERSPEC-style brief that upgrades AI Rebuild
 * from generic token dump → component tree + interaction model.
 */

import type { Blueprint } from "@/lib/blueprint/types";
import { extractPrimarySecondary } from "./prompter";

export type ArchitectureCompilerOptions = {
  focus?: "product_shell" | "full";
  depth?: "deep" | "shallow";
  thinHtmlMode?: "aggressive" | "normal";
};

export type ArchitectureCompilerPrompt = {
  systemPrompt: string;
  userPrompt: string;
  fullPrompt: string;
  evidence: ArchitectureEvidence;
  meta: {
    thinHtml: boolean;
    routeCandidates: number;
    componentHints: number;
    formCount: number;
    techCount: number;
  };
};

/** Slim, high-signal evidence (no base64 / CSS dump / full HTML). */
export type ArchitectureEvidence = {
  blueprintId: string;
  sourceUrl: string | null;
  finalUrl: string | null;
  isThinHtml: boolean;
  thinHtmlReasons: string[];
  meta: {
    title: string;
    description: string;
    language: string | null;
    themeColor: string | null;
  };
  tech: Array<{ name: string; confidence: string; evidence: string }>;
  design: {
    primary: string | null;
    secondary: string | null;
    palette: string[];
    fonts: string[];
    cssVariables: Record<string, string>;
    borderRadii: string[];
    typography: Array<{
      selector: string;
      fontFamily: string | null;
      fontSize: string | null;
      fontWeight: string | null;
      lineHeight: string | null;
      letterSpacing: string | null;
    }>;
  };
  headings: Array<{ level: number; text: string }>;
  links: {
    internal: Array<{ href: string; text: string }>;
    externalSample: Array<{ href: string; text: string }>;
  };
  forms: Array<{
    action: string;
    method: string;
    category?: string;
    fields: Array<{ name: string; type: string; required: boolean; placeholder?: string }>;
  }>;
  pages: Array<{
    url: string;
    title: string;
    headings: Array<{ level: number; text: string }>;
  }>;
  outlineSample: unknown;
  wordpressHints: {
    isWordPress: boolean;
    isJetEngine: boolean;
    isElementor: boolean;
    listingGridCount: number;
    cctTypeSlugs: string[];
    dynamicFieldCount: number;
  } | null;
  notes: string[];
  limitations: string[];
  partialErrors: Array<{ stage: string; message: string }>;
};

/** Exact system prompt from product spec (SPA-Aware UI Architecture Compiler). */
export const ARCHITECTURE_SYSTEM_PROMPT = `# ROLE
Si senior product reverse-engineer + UI systems architect.
Úloha: z Blueprint JSON (a voliteľne raw HTML) vytvoriť HIGH-SIGNAL UI ARCHITECTURE SPEC,
podľa ktorého sa dá rebuildnúť skutočný app shell — nie generická landing page.

# REALITA
- Nie si klon backendu/DB/auth secrets.
- Ak je blueprint.isThinHtml === true, explicitne rekonštruuj shell z tech signálov,
  internal links, headings a form patterns — nevracaj prázdne "Loading…".
- Cieľ: 80–90 % verejného UI + interaction model.

# OPTIONS
  focus: product_shell   # home + core app routes pred marketing noise
  depth: deep
  thinHtmlMode: aggressive | normal

# PIPELINE (v tomto poradí)

## 1) PRODUCT IDENTITY
- name, oneLiner, category
- primaryUserGoal (1 veta)
- authGate: čo je viditeľné bez login vs za Sign in
- originHints (GitHub, "Deploy your own", clone URL) ak existujú

## 2) ROUTE MAP
Pre každú relevantnú path:
- path, purpose (shell | feature | marketing | legal)
- priority: core | secondary | noise
- dominantUI (1 veta)
- keyHeadings (max 8)

## 3) COMPONENT TREE (povinné, nie "div/body")
Pre každý core komponent uveď:
- name (PascalCase)
- role (nav | hero | listing-grid | form | sidebar | footer | modal | empty-state …)
- propsSignals (čo sa dá odvodiť z DOM: title, items[], ctaLabel, imageUrl …)
- children[]
- repeated: true/false (listing item template)
- dataSourceHint (static | jet-listing | rest | client-fetch | unknown)

## 4) INTERACTION MODEL
- happyPath: kroky používateľa od vstupu po primárny cieľ
- authGated: čo zmizne / redirectuje bez session
- navigation: hlavné CTA a internal routes
- states: loading | empty | error | success surfaces (ak sú v DOM alebo logicky nutné)

## 5) DESIGN BINDING
- 4–8 kľúčových tokenov (primary, surface, text, accent, radius, font)
- typography scale (h1/h2/body/button) z blueprint.design.typography ak existuje
- NEVYPISUJ --tw-* utility dump

## 6) REBUILD ORDER (5 krokov)
Presné poradie implementácie pre Next.js App Router + Tailwind.

# OUTPUT (iba toto, v poradí)

1) JSON:
{
  "id": "UIARCH_<slug>_<timestamp>",
  "version": "1.0.0",
  "product": { "name": "", "oneLiner": "", "category": "", "primaryUserGoal": "", "authGate": "" },
  "routes": [],
  "components": [],
  "interactions": { "happyPath": [], "authGated": [], "navigation": [], "states": [] },
  "designBinding": { "tokens": {}, "typography": [] },
  "rebuildOrder": [],
  "gaps": [],
  "thinHtmlNotes": []
}

2) HUMAN SUMMARY (SK, max 12 riadkov)
- čo to je
- core shell (3–5 komponentov)
- top 3 gaps
- 5 krokov rebuildu

# QUALITY BAR — FAIL ak:
- components[] je prázdne alebo len "Page/Div"
- summary bez mien UI blokov
- legal/marketing pages majú vyššiu prioritu než product shell
- JSON obsahuje CSS dump / base64

# ŠTART
Potvrď prijatie Blueprint evidence v 1 riadku, potom spusti pipeline bez ďalších otázok.`;

function slimOutline(node: unknown, depth = 0): unknown {
  if (!node || typeof node !== "object" || depth > 3) return undefined;
  const n = node as {
    tag?: string;
    id?: string;
    classes?: string[];
    role?: string;
    text?: string;
    children?: unknown[];
  };
  const out: Record<string, unknown> = {
    tag: n.tag,
  };
  if (n.id) out.id = n.id;
  if (n.classes?.length) out.classes = n.classes.slice(0, 6);
  if (n.role) out.role = n.role;
  if (n.text) out.text = n.text.slice(0, 80);
  if (n.children?.length) {
    out.children = n.children
      .slice(0, depth === 0 ? 12 : 6)
      .map((c) => slimOutline(c, depth + 1))
      .filter(Boolean);
  }
  return out;
}

function pathFromUrl(href: string, base: string | null): string {
  try {
    const u = new URL(href, base || "https://blueprint.local/");
    return u.pathname || "/";
  } catch {
    return href;
  }
}

/** Build slim evidence payload from a full Blueprint (safe for LLM context). */
export function buildArchitectureEvidence(bp: Blueprint): ArchitectureEvidence {
  const { primary, secondary, palette } = extractPrimarySecondary(bp);
  const cssVars = { ...(bp.design?.cssVariables || {}) };
  // drop noisy utility-like keys
  for (const k of Object.keys(cssVars)) {
    if (k.startsWith("--tw-") || cssVars[k].length > 120) delete cssVars[k];
  }
  const cssVarEntries = Object.fromEntries(Object.entries(cssVars).slice(0, 36));

  const internal = (bp.links || [])
    .filter((l) => l.internal)
    .slice(0, 40)
    .map((l) => ({ href: l.href, text: l.text }));
  const external = (bp.links || [])
    .filter((l) => !l.internal)
    .slice(0, 12)
    .map((l) => ({ href: l.href, text: l.text }));

  const wp = bp.wordpress;
  const wordpressHints = wp
    ? {
        isWordPress: Boolean(wp.isWordPress),
        isJetEngine: Boolean(wp.isJetEngine),
        isElementor: Boolean(wp.isElementor),
        listingGridCount: Array.isArray(wp.listingGrids)
          ? wp.listingGrids.length
          : 0,
        cctTypeSlugs: Array.isArray(wp.cctTypes)
          ? wp.cctTypes.map((c: { slug?: string }) => c.slug || "").filter(Boolean).slice(0, 20)
          : [],
        dynamicFieldCount: Array.isArray(wp.dynamicFields)
          ? wp.dynamicFields.length
          : 0,
      }
    : null;

  return {
    blueprintId: bp.id,
    sourceUrl: bp.sourceUrl,
    finalUrl: bp.finalUrl,
    isThinHtml: Boolean(bp.isThinHtml),
    thinHtmlReasons: bp.thinHtmlReasons || [],
    meta: {
      title: bp.meta?.title || "",
      description: bp.meta?.description || "",
      language: bp.meta?.language ?? null,
      themeColor: bp.meta?.themeColor ?? null,
    },
    tech: (bp.tech || []).slice(0, 24).map((t) => ({
      name: t.name,
      confidence: t.confidence,
      evidence: t.evidence,
    })),
    design: {
      primary,
      secondary,
      palette: palette.slice(0, 16),
      fonts: [...new Set(bp.design?.fonts || [])].slice(0, 10),
      cssVariables: cssVarEntries,
      borderRadii: (bp.design?.borderRadii || []).slice(0, 8),
      typography: (bp.design?.typography || []).slice(0, 12).map((t) => ({
        selector: t.selector,
        fontFamily: t.fontFamily,
        fontSize: t.fontSize,
        fontWeight: t.fontWeight,
        lineHeight: t.lineHeight,
        letterSpacing: t.letterSpacing,
      })),
    },
    headings: (bp.headings || []).slice(0, 32),
    links: { internal, externalSample: external },
    forms: (bp.forms || []).slice(0, 16).map((f) => ({
      action: f.action,
      method: f.method,
      category: f.category,
      fields: (f.fields || []).slice(0, 20).map((field) => ({
        name: field.name,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder,
      })),
    })),
    pages: (bp.pages || []).slice(0, 16).map((p) => ({
      url: p.url,
      title: p.title || "",
      headings: (p.headings || []).slice(0, 8),
    })),
    outlineSample: slimOutline(bp.outline),
    wordpressHints,
    notes: (bp.notes || []).slice(0, 20),
    limitations: (bp.limitations || []).slice(0, 12),
    partialErrors: (bp.partialErrors || []).slice(0, 15).map((e) => ({
      stage: e.stage,
      message: e.message,
    })),
  };
}

/** Route path candidates derived from internal links + crawled pages. */
export function deriveRouteCandidates(bp: Blueprint): string[] {
  const base = bp.finalUrl || bp.sourceUrl;
  const paths = new Set<string>(["/"]);
  for (const l of bp.links || []) {
    if (!l.internal) continue;
    paths.add(pathFromUrl(l.href, base));
  }
  for (const p of bp.pages || []) {
    paths.add(pathFromUrl(p.url, base));
  }
  return [...paths].slice(0, 30);
}

/**
 * Generate the full Architecture Compiler prompt (system + user with evidence).
 */
export function generateArchitectureCompilerPrompt(
  bp: Blueprint,
  options: ArchitectureCompilerOptions = {},
): ArchitectureCompilerPrompt {
  const focus = options.focus ?? "product_shell";
  const depth = options.depth ?? "deep";
  const thinHtmlMode =
    options.thinHtmlMode ?? (bp.isThinHtml ? "aggressive" : "normal");

  const evidence = buildArchitectureEvidence(bp);
  const routes = deriveRouteCandidates(bp);

  const userPrompt = [
    `# VSTUP — Architecture Compiler`,
    ``,
    `OPTIONS:`,
    `  focus: ${focus}`,
    `  depth: ${depth}`,
    `  thinHtmlMode: ${thinHtmlMode}`,
    ``,
    `BLUEPRINT_ID: ${bp.id}`,
    `SOURCE: ${bp.source} | thinHtml=${Boolean(bp.isThinHtml)}`,
    `URL: ${bp.finalUrl || bp.sourceUrl || "(html paste)"}`,
    ``,
    `## Route path candidates (from crawl/links)`,
    ...routes.map((r) => `- ${r}`),
    ``,
    `## HIGH-SIGNAL EVIDENCE (slim Blueprint — no HTML/CSS dump/base64)`,
    "```json",
    JSON.stringify(evidence, null, 2),
    "```",
    ``,
    `Spusti pipeline. Vráť JSON UIARCH spec + HUMAN SUMMARY (SK).`,
    bp.isThinHtml
      ? `POZOR: isThinHtml=true — rekonštruuj product shell agresívne z tech/links/forms/headings.`
      : `Preferuj product_shell pred marketing/legal noise.`,
  ].join("\n");

  const fullPrompt = [
    "=== SYSTEM ===",
    ARCHITECTURE_SYSTEM_PROMPT,
    "",
    "=== USER ===",
    userPrompt,
  ].join("\n");

  const componentHints =
    (evidence.forms?.length || 0) +
    (evidence.wordpressHints?.listingGridCount || 0) +
    (evidence.headings?.length
      ? Math.min(8, evidence.headings.length)
      : 0) +
    (evidence.outlineSample ? 3 : 0);

  return {
    systemPrompt: ARCHITECTURE_SYSTEM_PROMPT,
    userPrompt,
    fullPrompt,
    evidence,
    meta: {
      thinHtml: Boolean(bp.isThinHtml),
      routeCandidates: routes.length,
      componentHints,
      formCount: evidence.forms.length,
      techCount: evidence.tech.length,
    },
  };
}
