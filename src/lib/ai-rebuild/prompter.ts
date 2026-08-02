import type { Blueprint } from "@/lib/blueprint/types";

/** Alias used by AI Rebuild Studio (full blueprint snapshot). */
export type BlueprintJSON = Blueprint;

export type AiRebuildPrompt = {
  systemPrompt: string;
  userPrompt: string;
  /** Combined clipboard-ready prompt (system + user) */
  fullPrompt: string;
  /** Suggested Tailwind theme fragment from design tokens */
  tailwindConfigJs: string;
  meta: {
    title: string;
    colorCount: number;
    fontCount: number;
    headingCount: number;
    formCount: number;
    techCount: number;
  };
};

const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}){1,2}$/;
const RGB_RE = /^rgba?\(/i;

function isColorToken(v: string): boolean {
  const s = v.trim();
  return HEX_RE.test(s) || RGB_RE.test(s) || /^oklch\(/i.test(s) || /^hsl/i.test(s);
}

function slugColorKey(raw: string, index: number): string {
  const cleaned = raw
    .replace(/^--/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  if (!cleaned || cleaned.length < 2) return `color-${index + 1}`;
  return cleaned.slice(0, 40);
}

/** Pick primary/secondary from design tokens with safe fallbacks. */
export function extractPrimarySecondary(bp: BlueprintJSON): {
  primary: string | null;
  secondary: string | null;
  palette: string[];
} {
  const colors = [...(bp.design?.colors || [])].filter(Boolean);
  const cssVars = bp.design?.cssVariables || {};
  const elColors = bp.design?.elementorGlobals?.colors || {};

  const fromVars: string[] = [];
  for (const [k, v] of Object.entries({ ...cssVars, ...elColors })) {
    if (typeof v === "string" && isColorToken(v)) {
      if (/primary|brand|accent|main/i.test(k)) fromVars.unshift(v.trim());
      else fromVars.push(v.trim());
    }
  }

  const palette = [...new Set([...fromVars, ...colors.map((c) => c.trim())])].filter(
    isColorToken,
  );

  return {
    primary: palette[0] || bp.meta?.themeColor || null,
    secondary: palette[1] || palette[0] || null,
    palette: palette.slice(0, 24),
  };
}

export function formatTypographySection(bp: BlueprintJSON): string {
  const rows = bp.design?.typography || [];
  if (!rows.length) {
    return [
      "### Typography",
      "- (no exact typography tokens extracted)",
      "- Infer a clean scale: h1 2.25–3rem bold, h2 1.75–2rem semibold, h3 1.25–1.5rem semibold, body 1rem/1.6, button 0.875–1rem medium.",
    ].join("\n");
  }

  const lines = ["### Typography"];
  for (const t of rows) {
    const bits = [
      t.fontFamily && `family=${t.fontFamily}`,
      t.fontSize && `size=${t.fontSize}`,
      t.fontWeight && `weight=${t.fontWeight}`,
      t.lineHeight && `lh=${t.lineHeight}`,
      t.letterSpacing && `ls=${t.letterSpacing}`,
      `source=${t.source}`,
    ].filter(Boolean);
    lines.push(`- **${t.selector}**: ${bits.join(", ")}`);
  }
  return lines.join("\n");
}

export function formatStructureSection(bp: BlueprintJSON): string {
  const headings = (bp.headings || []).slice(0, 24);
  const forms = (bp.forms || []).slice(0, 12);
  const tech = (bp.tech || []).slice(0, 20);
  const pages = (bp.pages || []).slice(0, 12);
  const links = (bp.links || []).filter((l) => l.internal).slice(0, 16);

  const lines: string[] = [
    "### Page structure",
    `- **Title**: ${bp.meta?.title || "(untitled)"}`,
    `- **Description**: ${bp.meta?.description || "(none)"}`,
    `- **Source URL**: ${bp.sourceUrl || bp.finalUrl || "(html paste)"}`,
    `- **Language**: ${bp.meta?.language || "unknown"}`,
  ];

  if (bp.isThinHtml) {
    lines.push(
      `- **⚠ Thin HTML / SPA shell**: content may be incomplete. Prefer layout skeleton + known sections.`,
    );
  }

  lines.push("", "#### Headings");
  if (!headings.length) lines.push("- (no headings extracted)");
  else {
    for (const h of headings) {
      lines.push(`- H${h.level}: ${h.text}`);
    }
  }

  lines.push("", "#### Detected tech");
  if (!tech.length) lines.push("- (none)");
  else {
    for (const t of tech) {
      lines.push(`- ${t.name} (${t.confidence}) — ${t.evidence}`);
    }
  }

  lines.push("", "#### Forms");
  if (!forms.length) lines.push("- (no forms)");
  else {
    for (const f of forms) {
      const fields = (f.fields || [])
        .map((x) => `${x.name}:${x.type}${x.required ? "*" : ""}`)
        .join(", ");
      lines.push(
        `- [${f.category || "form"}] ${f.method} → ${f.action || "(no action)"} | fields: ${fields || "(none)"}`,
      );
    }
  }

  if (pages.length) {
    lines.push("", "#### Additional crawled pages");
    for (const p of pages) {
      lines.push(`- ${p.url} — ${p.title || "(no title)"}`);
    }
  }

  if (links.length) {
    lines.push("", "#### Internal nav links (sample)");
    for (const l of links) {
      lines.push(`- [${l.text || "link"}](${l.href})`);
    }
  }

  return lines.join("\n");
}

export function formatDesignTokensSection(bp: BlueprintJSON): string {
  const { primary, secondary, palette } = extractPrimarySecondary(bp);
  const fonts = [...new Set(bp.design?.fonts || [])].slice(0, 12);
  const cssVars = bp.design?.cssVariables || {};
  const el = bp.design?.elementorGlobals;
  const radii = (bp.design?.borderRadii || []).slice(0, 8);
  const shadows = (bp.design?.shadows || []).slice(0, 6);

  const lines: string[] = [
    "### Design tokens",
    "",
    "#### Colors",
    `- **Primary**: ${primary || "(infer dark premium accent, e.g. #C8A16E)"}`,
    `- **Secondary**: ${secondary || "(infer supporting neutral)"}`,
    `- **Theme color meta**: ${bp.meta?.themeColor || "(none)"}`,
    `- **Palette** (${palette.length}):`,
  ];

  if (!palette.length) {
    lines.push("  - (no colors extracted — use a cohesive dark SaaS palette)");
  } else {
    for (const c of palette) lines.push(`  - \`${c}\``);
  }

  lines.push("", "#### CSS variables");
  const varEntries = Object.entries(cssVars).slice(0, 40);
  if (!varEntries.length) lines.push("- (none)");
  else {
    for (const [k, v] of varEntries) lines.push(`- \`${k}\`: ${v}`);
  }

  if (el?.colors && Object.keys(el.colors).length) {
    lines.push("", "#### Elementor global colors");
    for (const [k, v] of Object.entries(el.colors).slice(0, 20)) {
      lines.push(`- \`${k}\`: ${v}`);
    }
  }

  lines.push("", "#### Fonts");
  if (!fonts.length) lines.push("- (none extracted — use Inter or system-ui stack)");
  else for (const f of fonts) lines.push(`- ${f}`);

  if (radii.length) {
    lines.push("", "#### Border radii", ...radii.map((r) => `- ${r}`));
  }
  if (shadows.length) {
    lines.push("", "#### Shadows", ...shadows.map((s) => `- ${s}`));
  }

  return lines.join("\n");
}

/**
 * Generate a Tailwind-oriented theme config snippet from blueprint design tokens.
 * Safe when tokens are missing (emits sensible placeholders).
 */
export function generateTailwindConfigJs(bp: BlueprintJSON): string {
  const { primary, secondary, palette } = extractPrimarySecondary(bp);
  const fonts = [...new Set(bp.design?.fonts || [])].filter(Boolean);

  const colors: Record<string, string> = {};
  if (primary) colors.primary = primary;
  if (secondary && secondary !== primary) colors.secondary = secondary;

  palette.forEach((c, i) => {
    const key = slugColorKey(c, i);
    if (!colors[key]) colors[key] = c;
    // also index neutrals
    colors[`swatch-${i + 1}`] = c;
  });

  if (!Object.keys(colors).length) {
    colors.primary = "#C8A16E";
    colors.secondary = "#1A1814";
    colors.canvas = "#0a0a0b";
  }

  const fontFamily: Record<string, string[]> = {};
  if (fonts[0]) {
    fontFamily.sans = [fonts[0], "ui-sans-serif", "system-ui", "sans-serif"];
  }
  if (fonts[1]) {
    fontFamily.display = [fonts[1], "ui-sans-serif", "system-ui", "sans-serif"];
  }
  if (!Object.keys(fontFamily).length) {
    fontFamily.sans = ["Inter", "ui-sans-serif", "system-ui", "sans-serif"];
  }

  const theme = {
    extend: {
      colors,
      fontFamily,
      borderRadius: Object.fromEntries(
        (bp.design?.borderRadii || []).slice(0, 6).map((r, i) => [
          i === 0 ? "DEFAULT" : `r${i + 1}`,
          r,
        ]),
      ),
    },
  };

  // Pretty JS module fragment (not full file) for copy-paste into tailwind.config
  return `// Generated from Blueprint ${bp.id}
// Paste into theme.extend of tailwind.config.js / .ts
module.exports = ${JSON.stringify(theme, null, 2)};
`;
}

export function buildSystemPrompt(): string {
  return `You are a Senior Frontend Engineer specializing in production React and design systems.

Your task: rebuild the public UI described in the user blueprint as a **production-quality** React component using:
- **Next.js App Router** conventions (client components only when needed)
- **TypeScript**
- **Tailwind CSS** utility classes (no CSS modules unless required)
- Semantic HTML (header, main, section, nav, footer, forms with labels)
- Accessible focus states, responsive layout (mobile-first, ~390px → desktop)
- Match provided **design tokens** (colors, fonts, radii, typography) as closely as possible

Hard rules:
1. Output a single self-contained page component (default export) plus any small subcomponents in the same file if needed.
2. Do NOT invent backend APIs, secrets, or auth. Use static/mock content from the blueprint.
3. If the blueprint marks thin HTML / SPA shell, reconstruct a credible marketing or app shell from headings, links, and tokens — do not leave empty placeholders.
4. Prefer Tailwind arbitrary values for exact HEX when needed, e.g. text-[#C8A16E].
5. No external UI kit imports unless already listed in tech stack.
6. Return ONLY code (and brief file path comments), no long essay.`;
}

export function buildUserPrompt(bp: BlueprintJSON): string {
  const design = formatDesignTokensSection(bp);
  const type = formatTypographySection(bp);
  const structure = formatStructureSection(bp);
  const tw = generateTailwindConfigJs(bp);

  return [
    `# AI Rebuild brief — ${bp.meta?.title || bp.id}`,
    "",
    `Blueprint ID: \`${bp.id}\``,
    `Version: ${bp.version}`,
    `Scan source: ${bp.source}`,
    "",
    design,
    "",
    type,
    "",
    structure,
    "",
    "### Suggested Tailwind theme fragment",
    "```js",
    tw.trim(),
    "```",
    "",
    "### Deliverable",
    "Generate `app/page.tsx` (or `components/RebuiltPage.tsx`) that visually rebuilds the main landing/shell using the tokens and structure above.",
    "Include: sticky/top nav if links exist, hero from H1 + description, feature/sections from remaining headings, forms if present, footer.",
    "Use the primary/secondary colors and font stack consistently.",
  ].join("\n");
}

/**
 * Build system + user prompts for Claude / ChatGPT / Cursor to rebuild UI from a Blueprint.
 */
export function generateAiRebuildPrompt(blueprint: BlueprintJSON): AiRebuildPrompt {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(blueprint);
  const tailwindConfigJs = generateTailwindConfigJs(blueprint);
  const { palette } = extractPrimarySecondary(blueprint);

  const fullPrompt = [
    "=== SYSTEM ===",
    systemPrompt,
    "",
    "=== USER ===",
    userPrompt,
  ].join("\n");

  return {
    systemPrompt,
    userPrompt,
    fullPrompt,
    tailwindConfigJs,
    meta: {
      title: blueprint.meta?.title || "",
      colorCount: palette.length,
      fontCount: (blueprint.design?.fonts || []).length,
      headingCount: (blueprint.headings || []).length,
      formCount: (blueprint.forms || []).length,
      techCount: (blueprint.tech || []).length,
    },
  };
}
