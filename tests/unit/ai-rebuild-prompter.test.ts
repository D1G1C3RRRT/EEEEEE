import { describe, expect, it } from "vitest";
import {
  extractPrimarySecondary,
  generateAiRebuildPrompt,
  generateTailwindConfigJs,
  type BlueprintJSON,
} from "@/lib/ai-rebuild/prompter";
import { makeMinimalBlueprint } from "../fixtures/minimal-blueprint";

function richBlueprint(): BlueprintJSON {
  return makeMinimalBlueprint({
    meta: {
      ...makeMinimalBlueprint().meta,
      title: "Acme Dashboard",
      description: "Ops console",
      themeColor: "#0F0E0C",
    },
    design: {
      colors: ["#0a0a0b", "#C8A16E", "rgb(40, 40, 42)"],
      fonts: ["Inter", "JetBrains Mono"],
      cssVariables: {
        "--color-primary": "#C8A16E",
        "--color-bg": "#0a0a0b",
      },
      borderRadii: ["12px", "16px"],
      shadows: ["0 8px 24px rgba(0,0,0,.35)"],
      spacingHints: [],
      typography: [
        {
          selector: "h1",
          fontFamily: "Inter",
          fontSize: "40px",
          fontWeight: "700",
          lineHeight: "1.15",
          letterSpacing: "-0.02em",
          source: "css-rule",
        },
        {
          selector: "body",
          fontFamily: "Inter",
          fontSize: "16px",
          fontWeight: "400",
          lineHeight: "1.6",
          letterSpacing: null,
          source: "css-rule",
        },
        {
          selector: "button",
          fontFamily: "Inter",
          fontSize: "14px",
          fontWeight: "500",
          lineHeight: "1.2",
          letterSpacing: null,
          source: "inferred",
        },
      ],
    },
    headings: [
      { level: 1, text: "Welcome to Acme" },
      { level: 2, text: "Features" },
    ],
    tech: [
      { name: "React", confidence: "high", evidence: "test" },
      { name: "Tailwind CSS", confidence: "medium", evidence: "class" },
    ],
  });
}

describe("AI Rebuild prompter", () => {
  it("generateAiRebuildPrompt returns non-empty system + user prompts", () => {
    const out = generateAiRebuildPrompt(richBlueprint());
    expect(out.systemPrompt.length).toBeGreaterThan(80);
    expect(out.userPrompt.length).toBeGreaterThan(120);
    expect(out.fullPrompt).toContain("=== SYSTEM ===");
    expect(out.fullPrompt).toContain("=== USER ===");
    expect(out.systemPrompt).toMatch(/Senior Frontend Engineer|Tailwind/i);
    expect(out.userPrompt).toMatch(/Design tokens|Typography|structure/i);
    expect(out.userPrompt).toContain("Acme Dashboard");
    expect(out.userPrompt).toContain("#C8A16E");
    expect(out.meta.headingCount).toBe(2);
    expect(out.meta.colorCount).toBeGreaterThan(0);
  });

  it("handles missing tokens without throwing", () => {
    const empty = makeMinimalBlueprint({
      design: {
        colors: [],
        fonts: [],
        cssVariables: {},
        borderRadii: [],
        shadows: [],
        spacingHints: [],
      },
      headings: [],
      forms: [],
      tech: [],
      meta: {
        ...makeMinimalBlueprint().meta,
        title: "",
        description: "",
        themeColor: null,
      },
    });
    const out = generateAiRebuildPrompt(empty);
    expect(out.systemPrompt).toBeTruthy();
    expect(out.userPrompt).toMatch(/no colors extracted|infer/i);
    expect(out.userPrompt).toMatch(/Typography/);
    expect(out.tailwindConfigJs).toMatch(/primary/);
    expect(out.meta.colorCount).toBe(0);
  });

  it("formats Tailwind colors from palette + css vars", () => {
    const js = generateTailwindConfigJs(richBlueprint());
    expect(js).toMatch(/module\.exports/);
    expect(js).toContain("#C8A16E");
    expect(js).toContain("#0a0a0b");
    expect(js).toMatch(/Inter/);
    // valid-ish JSON object inside
    const jsonPart = js.slice(js.indexOf("{"));
    const parsed = JSON.parse(jsonPart.replace(/;\s*$/, ""));
    expect(parsed.extend.colors.primary).toBeTruthy();
    expect(parsed.extend.fontFamily.sans[0]).toBe("Inter");
  });

  it("extractPrimarySecondary prefers css var named primary", () => {
    const { primary, secondary, palette } = extractPrimarySecondary(
      makeMinimalBlueprint({
        design: {
          colors: ["#111111", "#222222"],
          fonts: [],
          cssVariables: { "--color-primary": "#FF00AA" },
          borderRadii: [],
          shadows: [],
          spacingHints: [],
        },
      }),
    );
    expect(primary).toBe("#FF00AA");
    expect(secondary).toBeTruthy();
    expect(palette[0]).toBe("#FF00AA");
  });

  it("includes form and tech structure in user prompt", () => {
    const out = generateAiRebuildPrompt(richBlueprint());
    expect(out.userPrompt).toMatch(/React/);
    expect(out.userPrompt).toMatch(/H1: Welcome to Acme/);
    expect(out.userPrompt).toMatch(/login|email|Forms/i);
  });

  it("mentions thin HTML when flag set", () => {
    const out = generateAiRebuildPrompt(
      makeMinimalBlueprint({
        isThinHtml: true,
        thinHtmlReasons: ["SPA shell"],
      }),
    );
    expect(out.userPrompt).toMatch(/Thin HTML|SPA/i);
  });
});
