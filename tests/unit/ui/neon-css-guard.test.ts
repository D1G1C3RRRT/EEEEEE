import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("neon css compatibility guard", () => {
  const root = path.resolve(__dirname, "../../..");
  const css = readFileSync(path.join(root, "src", "styles.css"), "utf8");

  it("contains @supports-gated neon animation", () => {
    expect(css).toMatch(/@supports\s*\(background:\s*conic-gradient\(from var\(--neon-angle\)/);
    expect(css).toMatch(/\.neon-border-wrapper::before\s*\{[\s\S]*animation:\s*neon-spin/);
    expect(css).toMatch(/\.toggle-neon-ring::before\s*\{[\s\S]*animation:\s*toggle-neon-spin/);
  });

  it("keeps static fallback when animated custom props are unavailable", () => {
    expect(css).toMatch(/\.neon-border-wrapper::before\s*\{[\s\S]*from 0deg[\s\S]*animation:\s*none/);
    expect(css).toMatch(/\.toggle-neon-ring::before\s*\{[\s\S]*from 0deg[\s\S]*animation:\s*none/);
  });

  it("disables neon motion in prefers-reduced-motion mode", () => {
    const reducedMotionBlock =
      css.match(
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n {2}\}/,
      )?.[0] ??
      "";
    expect(reducedMotionBlock).toContain(".neon-border-wrapper::before");
    expect(reducedMotionBlock).toContain(".neon-border-wrapper::after");
    expect(reducedMotionBlock).toContain(".toggle-neon-ring::before");
    expect(reducedMotionBlock).toContain("animation: none;");
    expect(reducedMotionBlock).not.toContain("neon-glow-pulse");
  });

  it("uses theme accent variables for neon colors", () => {
    expect(css).toMatch(/var\(--color-accent\)/);
  });
});
