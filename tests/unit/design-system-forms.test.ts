import { describe, expect, it } from "vitest";
import {
  collectInlineStyleCss,
  extractDesignForms,
  extractDesignSystem,
  toFullWpUploadUrl,
} from "@/lib/blueprint/design-system";

describe("design-system · forms + helpers", () => {
  it("classifies register, booking, newsletter, search, checkout", () => {
    const html = `
      <form class="woocommerce-form-register" action="/register" method="post">
        <input name="email" type="email" required />
        <input name="password" type="password" required />
        <button type="submit">Register</button>
      </form>
      <form class="booking-form" action="/book" method="post">
        <input name="date" type="date" required />
        <input name="guests" type="number" />
        <input name="appointment_time" type="time" />
      </form>
      <form class="mc4wp-form newsletter" action="/subscribe" method="post">
        <input name="EMAIL" type="email" required />
      </form>
      <form action="/?s=" method="get">
        <input name="s" type="search" />
      </form>
      <form class="woocommerce-checkout" action="/checkout" method="post">
        <input name="billing_email" type="email" />
        <input name="payment_method" type="radio" />
      </form>
    `;
    const forms = extractDesignForms(html, "https://shop.test/");
    const cats = forms.map((f) => f.category);
    expect(cats).toEqual(
      expect.arrayContaining([
        "register",
        "booking",
        "newsletter",
        "search",
        "checkout",
      ]),
    );
  });

  it("collectInlineStyleCss finds elementor-frontend-inline-css", () => {
    const html = `<style id="elementor-frontend-inline-css">:root{--e-global-color-primary:#111}</style>
      <style id="other">body{color:red}</style>`;
    const { styleIds, elementorInline, css } = collectInlineStyleCss(html);
    expect(styleIds).toContain("elementor-frontend-inline-css");
    expect(elementorInline).toMatch(/--e-global-color-primary/);
    expect(css).toMatch(/color:red/);
  });

  it("toFullWpUploadUrl optionally strips -scaled", () => {
    const u =
      "https://cdn.test/wp-content/uploads/2024/01/photo-scaled.jpg";
    expect(toFullWpUploadUrl(u, false)).toContain("photo-scaled.jpg");
    expect(toFullWpUploadUrl(u, true)).toBe(
      "https://cdn.test/wp-content/uploads/2024/01/photo.jpg",
    );
  });

  it("extractDesignSystem notes summarize findings", () => {
    const html = `<html><head>
      <style id="elementor-frontend-inline-css">
        :root { --e-global-color-primary: #000; --e-global-typography-text-font-size: 16px; }
      </style></head>
      <body>
        <img src="https://x.test/wp-content/uploads/2024/h-300x200.png" />
        <form action="/wp-login.php" method="post">
          <input name="log" /><input name="pwd" type="password" />
        </form>
      </body></html>`;
    const ds = extractDesignSystem(html, "https://x.test/");
    expect(ds.notes.length).toBeGreaterThan(0);
    expect(ds.elementor.colors["--e-global-color-primary"]).toBe("#000");
    expect(ds.fullImageUrls.some((u) => u.endsWith("/h.png"))).toBe(true);
    expect(ds.forms.some((f) => f.category === "login")).toBe(true);
  });
});
