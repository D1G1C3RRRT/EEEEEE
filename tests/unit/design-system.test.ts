import { describe, expect, it } from "vitest";
import {
  extractDesignSystem,
  extractElementorGlobals,
  extractFullImageUrls,
  extractTypographyTokens,
  toFullWpUploadUrl,
} from "@/lib/blueprint/design-system";
import { scanToBlueprint } from "@/lib/blueprint/scan";

const sampleHtml = `<!DOCTYPE html>
<html><head>
<style id="elementor-frontend-inline-css">
:root {
  --e-global-color-primary: #1A1814;
  --e-global-color-secondary: #C8A16E;
  --e-global-color-text: #E8E4DC;
  --e-global-typography-primary-font-family: "Inter";
  --e-global-typography-primary-font-size: 48px;
  --e-global-typography-primary-font-weight: 700;
  --e-global-typography-primary-line-height: 1.2;
  --e-global-typography-primary-letter-spacing: -0.02em;
  --e-global-typography-text-font-family: "Inter";
  --e-global-typography-text-font-size: 16px;
  --e-global-typography-text-font-weight: 400;
  --e-global-typography-text-line-height: 1.6;
  --e-global-typography-accent-font-family: "Inter";
  --e-global-typography-accent-font-size: 14px;
  --e-global-typography-accent-font-weight: 600;
}
h1 { font-family: "Inter", sans-serif; font-size: 48px; font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; }
h2 { font-size: 32px; font-weight: 600; line-height: 1.25; }
body { font-family: Inter, sans-serif; font-size: 16px; font-weight: 400; line-height: 1.6; }
button, .elementor-button { font-size: 14px; font-weight: 600; letter-spacing: 0.02em; }
</style>
</head>
<body>
  <img src="https://site.example/wp-content/uploads/2024/05/hero-1024x768.jpg" />
  <img srcset="https://site.example/wp-content/uploads/2024/05/card-300x200.png 300w, https://site.example/wp-content/uploads/2024/05/card-768x512.png 768w" />
  <form id="loginform" class="login-form" action="https://site.example/wp-login.php" method="post">
    <input type="text" name="log" required autocomplete="username" />
    <input type="password" name="pwd" required autocomplete="current-password" />
    <input type="submit" value="Prihlásiť" />
  </form>
  <form class="wpcf7-form" action="https://site.example/kontakt/#wpcf7" method="post">
    <input type="email" name="your-email" required placeholder="Email" />
    <textarea name="your-message" required></textarea>
    <button type="submit">Odoslať</button>
  </form>
  <form action="https://site.example/wp-login.php?action=lostpassword" method="post">
    <input type="text" name="user_login" required />
    <input type="submit" value="Reset" />
  </form>
</body></html>`;

describe("design-system extract", () => {
  it("strips WP thumbnail suffixes", () => {
    expect(
      toFullWpUploadUrl(
        "https://x.com/wp-content/uploads/2024/05/hero-1024x768.jpg",
      ),
    ).toBe("https://x.com/wp-content/uploads/2024/05/hero.jpg");
    expect(
      toFullWpUploadUrl(
        "https://x.com/wp-content/uploads/2024/05/card-300x200.png?ver=1",
      ),
    ).toBe("https://x.com/wp-content/uploads/2024/05/card.png?ver=1");
  });

  it("extracts --e-global-color and typography vars from elementor inline css", () => {
    const g = extractElementorGlobals(sampleHtml);
    expect(g.colors["--e-global-color-primary"]).toBe("#1A1814");
    expect(g.colors["--e-global-color-secondary"]).toBe("#C8A16E");
    expect(g.typography["--e-global-typography-primary-font-size"]).toBe("48px");
    expect(g.styleIds).toContain("elementor-frontend-inline-css");
  });

  it("extracts h1/h2/body/button typography", () => {
    const g = extractElementorGlobals(sampleHtml);
    const t = extractTypographyTokens(sampleHtml, [], g);
    const h1 = t.find((x) => x.selector === "h1")!;
    expect(h1.fontSize).toBe("48px");
    expect(h1.fontWeight).toBe("700");
    expect(h1.lineHeight).toBeTruthy();
    expect(h1.lineHeight).toMatch(/^1\./);
    const body = t.find((x) => x.selector === "body")!;
    expect(body.fontSize).toBe("16px");
    const btn = t.find((x) => x.selector === "button")!;
    expect(btn.fontWeight).toBe("600");
  });

  it("collects full-resolution image URLs", () => {
    const urls = extractFullImageUrls(sampleHtml, "https://site.example/");
    expect(urls.some((u) => u.endsWith("/hero.jpg"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/card.png"))).toBe(true);
    expect(urls.every((u) => !/-\d+x\d+\./.test(u))).toBe(true);
  });

  it("classifies login, contact, lost_password forms", () => {
    const ds = extractDesignSystem(sampleHtml, "https://site.example/");
    const cats = ds.forms.map((f) => f.category);
    expect(cats).toContain("login");
    expect(cats).toContain("contact");
    expect(cats).toContain("lost_password");
    const login = ds.forms.find((f) => f.category === "login")!;
    expect(login.fields.some((f) => f.name === "log" && f.required)).toBe(true);
    expect(login.fields.some((f) => f.type === "password")).toBe(true);
  });

  it("scanToBlueprint merges design system into blueprint.design", async () => {
    const { blueprint: bp } = await scanToBlueprint({
      html: sampleHtml,
      baseUrl: "https://site.example/",
      captureAssets: false,
      render: false,
      wayback: false,
      maxPages: 1,
      wpJetEngine: false,
    });
    expect(bp.design.elementorGlobals?.colors["--e-global-color-primary"]).toBe(
      "#1A1814",
    );
    expect(bp.design.typography?.some((t) => t.selector === "h1" && t.fontSize)).toBe(
      true,
    );
    expect(bp.design.fullImageUrls?.some((u) => u.includes("hero.jpg"))).toBe(true);
    expect(bp.forms.some((f) => f.category === "login")).toBe(true);
    expect(bp.assets.some((a) => a.url.includes("hero.jpg") && !a.url.includes("1024x768"))).toBe(
      true,
    );
  });
});
