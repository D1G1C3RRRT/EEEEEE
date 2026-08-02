import { parse, type HTMLElement } from "node-html-parser";

export interface TypographyToken {
  selector: string;
  fontFamily: string | null;
  fontSize: string | null;
  fontWeight: string | null;
  lineHeight: string | null;
  letterSpacing: string | null;
  source: "elementor-global" | "css-rule" | "inferred";
}

export interface ElementorGlobals {
  colors: Record<string, string>;
  typography: Record<string, string>;
  /** raw --e-global-* props */
  raw: Record<string, string>;
  inlineCssBytes: number;
  styleIds: string[];
}

export type FormCategory =
  | "login"
  | "register"
  | "lost_password"
  | "contact"
  | "booking"
  | "search"
  | "newsletter"
  | "checkout"
  | "auth"
  | "other";

export interface DesignFormField {
  name: string;
  type: string;
  required: boolean;
  placeholder?: string;
  label?: string;
  autocomplete?: string;
}

export interface DesignForm {
  action: string;
  method: string;
  category: FormCategory;
  id: string | null;
  classes: string[];
  fields: DesignFormField[];
  submitText: string | null;
  confidence: "high" | "medium" | "low";
  evidence: string;
}

export interface DesignSystemExtract {
  elementor: ElementorGlobals;
  typography: TypographyToken[];
  fullImageUrls: string[];
  forms: DesignForm[];
  notes: string[];
}

const WP_SIZE_SUFFIX =
  /-\d{2,5}x\d{2,5}(?=\.(?:jpe?g|png|gif|webp|avif|svg|bmp|tiff?)(?:\?|$))/i;
/** e.g. image-scaled.jpg (WP big image threshold) — keep; not a crop size we strip */
const WP_HASH_SUFFIX =
  /-[a-f0-9]{6,12}(?=\.(?:jpe?g|png|gif|webp|avif)(?:\?|$))/i;

/**
 * Strip WordPress intermediate size suffixes to prefer full / original upload URL.
 * `-300x200`, `-1024x768`, `-scaled` stays (optional strip of -scaled via flag).
 */
export function toFullWpUploadUrl(url: string, stripScaled = false): string {
  try {
    const u = new URL(url);
    if (!/\/wp-content\/uploads\//i.test(u.pathname)) return url;
    let path = u.pathname;
    path = path.replace(WP_SIZE_SUFFIX, "");
    // only strip short hex-like suffixes that look like WP cropped variants, not full filenames
    // avoid stripping legitimate names; only after size pattern already handled
    if (stripScaled) {
      path = path.replace(/-scaled(?=\.(?:jpe?g|png|gif|webp|avif)(?:\?|$))/i, "");
    }
    // hashed intermediate e.g. foo-ab12cd.jpg is rare; skip aggressive hash strip
    void WP_HASH_SUFFIX;
    u.pathname = path;
    return u.toString();
  } catch {
    return url.replace(WP_SIZE_SUFFIX, "");
  }
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

/** Collect CSS from elementor-frontend-inline-css + other inline styles */
export function collectInlineStyleCss(html: string): {
  css: string;
  styleIds: string[];
  elementorInline: string;
} {
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: true, style: true, noscript: true },
  });
  const styleIds: string[] = [];
  let elementorInline = "";
  const parts: string[] = [];

  for (const style of root.querySelectorAll("style")) {
    const id = style.getAttribute("id") || "";
    const text = style.text || "";
    if (!text.trim()) continue;
    if (id) styleIds.push(id);
    parts.push(text);
    if (
      id === "elementor-frontend-inline-css" ||
      id === "elementor-post-css" ||
      /elementor.*inline/i.test(id) ||
      /--e-global-color-/i.test(text)
    ) {
      elementorInline += `\n${text}`;
    }
  }
  return {
    css: parts.join("\n"),
    styleIds,
    elementorInline: elementorInline || parts.filter((p) => /--e-global-/i.test(p)).join("\n"),
  };
}

export function extractElementorGlobals(
  html: string,
  extraCss: string[] = [],
): ElementorGlobals {
  const { css: inlineCss, styleIds, elementorInline } = collectInlineStyleCss(html);
  const blob = [elementorInline, inlineCss, ...extraCss].join("\n");

  const colors: Record<string, string> = {};
  const typography: Record<string, string> = {};
  const raw: Record<string, string> = {};

  const varRe = /(--e-global-(?:color|typography)-[a-zA-Z0-9-_]+)\s*:\s*([^;}{]+)/g;
  let m: RegExpExecArray | null;
  while ((m = varRe.exec(blob)) && Object.keys(raw).length < 200) {
    const key = m[1];
    const val = m[2].trim();
    raw[key] = val;
    if (key.includes("-color-")) {
      colors[key] = val;
    } else if (key.includes("-typography-")) {
      typography[key] = val;
    }
  }

  // also catch nested like --e-global-color-primary without full re-run
  const colorOnly = /(--e-global-color-[a-zA-Z0-9-_]+)\s*:\s*([^;}{]+)/g;
  while ((m = colorOnly.exec(blob)) && Object.keys(colors).length < 80) {
    colors[m[1]] = m[2].trim();
    raw[m[1]] = m[2].trim();
  }
  const typeOnly = /(--e-global-typography-[a-zA-Z0-9-_]+)\s*:\s*([^;}{]+)/g;
  while ((m = typeOnly.exec(blob)) && Object.keys(typography).length < 120) {
    typography[m[1]] = m[2].trim();
    raw[m[1]] = m[2].trim();
  }

  return {
    colors,
    typography,
    raw,
    inlineCssBytes: Buffer.byteLength(elementorInline || inlineCss, "utf8"),
    styleIds: styleIds.filter((id) => /elementor/i.test(id)),
  };
}

function parseDeclBlock(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of block.split(";")) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim().toLowerCase();
    const v = part.slice(idx + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}

function pickTypeProps(decls: Record<string, string>): Omit<
  TypographyToken,
  "selector" | "source"
> {
  return {
    fontFamily: decls["font-family"]?.replace(/^["']|["']$/g, "") || null,
    fontSize: decls["font-size"] || null,
    fontWeight: decls["font-weight"] || null,
    lineHeight: decls["line-height"] || null,
    letterSpacing: decls["letter-spacing"] || null,
  };
}

const TARGET_SELECTORS = ["h1", "h2", "h3", "h4", "body", "button"] as const;

/**
 * Extract typography for h1–h4, body, button from CSS rules and Elementor globals.
 */
export function extractTypographyTokens(
  html: string,
  cssBundles: string[],
  elementor: ElementorGlobals,
): TypographyToken[] {
  const { css: inlineCss } = collectInlineStyleCss(html);
  const css = [inlineCss, ...cssBundles].join("\n");
  const results: TypographyToken[] = [];
  const found = new Map<string, TypographyToken>();

  // 1) Direct CSS rules: h1 { ... }, body { ... }, button, .elementor-button, etc.
  const ruleRe =
    /(^|[,}\s])((?:h[1-4]|body|button)(?:\s*,\s*(?:h[1-4]|body|button))*|(?:\.elementor-heading-title|\.elementor-button|\.button|\.btn)[^{]*)\{([^}]+)\}/gi;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(css))) {
    const selRaw = m[2].trim();
    const decls = parseDeclBlock(m[3]);
    const props = pickTypeProps(decls);
    if (
      !props.fontFamily &&
      !props.fontSize &&
      !props.fontWeight &&
      !props.lineHeight &&
      !props.letterSpacing
    ) {
      continue;
    }
    for (const target of TARGET_SELECTORS) {
      const hit =
        selRaw === target ||
        new RegExp(`(?:^|[,\\s])${target}(?:$|[,\\s:.\\[])`, "i").test(selRaw) ||
        (target === "button" &&
          /\.elementor-button|\.btn\b|\.button\b/i.test(selRaw)) ||
        (target.startsWith("h") && /elementor-heading-title/i.test(selRaw));
      if (!hit) continue;
      const prev = found.get(target);
      const token: TypographyToken = {
        selector: target,
        ...mergeType(prev, props),
        source: "css-rule",
      };
      found.set(target, token);
    }
  }

  // 2) Elementor global typography vars → map primary/secondary/text/accent to roles
  const e = elementor.typography;
  const mapGlobal = (role: string, keys: string[]) => {
    const decls: Record<string, string> = {};
    for (const [k, v] of Object.entries(e)) {
      const lower = k.toLowerCase();
      if (!keys.some((key) => lower.includes(key))) continue;
      if (lower.includes("font-family") || lower.endsWith("-family"))
        decls["font-family"] = v;
      else if (lower.includes("font-size") || lower.endsWith("-size"))
        decls["font-size"] = v;
      else if (lower.includes("font-weight") || lower.endsWith("-weight"))
        decls["font-weight"] = v;
      else if (lower.includes("line-height") || lower.endsWith("-line-height"))
        decls["line-height"] = v;
      else if (lower.includes("letter-spacing") || lower.endsWith("-letter-spacing"))
        decls["letter-spacing"] = v;
      // compact form: --e-global-typography-primary: ... sometimes single value; skip
    }
    return pickTypeProps(decls);
  };

  const roleMap: Array<{ sel: (typeof TARGET_SELECTORS)[number]; keys: string[] }> = [
    { sel: "h1", keys: ["primary", "h1"] },
    { sel: "h2", keys: ["secondary", "h2"] },
    { sel: "h3", keys: ["text", "h3", "accent"] },
    { sel: "h4", keys: ["accent", "h4", "text"] },
    { sel: "body", keys: ["text", "body", "primary"] },
    { sel: "button", keys: ["accent", "button", "primary"] },
  ];

  for (const { sel, keys } of roleMap) {
    const props = mapGlobal(sel, keys);
    if (
      props.fontFamily ||
      props.fontSize ||
      props.fontWeight ||
      props.lineHeight ||
      props.letterSpacing
    ) {
      const prev = found.get(sel);
      found.set(sel, {
        selector: sel,
        ...mergeType(prev, props, prev?.source === "css-rule" ? "prev" : "next"),
        source: prev?.source === "css-rule" ? "css-rule" : "elementor-global",
      });
    }
  }

  // 3) Ensure all targets present (empty if unknown)
  for (const sel of TARGET_SELECTORS) {
    if (!found.has(sel)) {
      found.set(sel, {
        selector: sel,
        fontFamily: null,
        fontSize: null,
        fontWeight: null,
        lineHeight: null,
        letterSpacing: null,
        source: "inferred",
      });
    }
    results.push(found.get(sel)!);
  }

  return results;
}

function mergeType(
  prev: TypographyToken | undefined,
  next: Omit<TypographyToken, "selector" | "source">,
  prefer: "prev" | "next" = "next",
): Omit<TypographyToken, "selector" | "source"> {
  if (!prev) return next;
  if (prefer === "prev") {
    return {
      fontFamily: prev.fontFamily || next.fontFamily,
      fontSize: prev.fontSize || next.fontSize,
      fontWeight: prev.fontWeight || next.fontWeight,
      lineHeight: prev.lineHeight || next.lineHeight,
      letterSpacing: prev.letterSpacing || next.letterSpacing,
    };
  }
  return {
    fontFamily: next.fontFamily || prev.fontFamily,
    fontSize: next.fontSize || prev.fontSize,
    fontWeight: next.fontWeight || prev.fontWeight,
    lineHeight: next.lineHeight || prev.lineHeight,
    letterSpacing: next.letterSpacing || prev.letterSpacing,
  };
}

export function extractFullImageUrls(html: string, base: string): string[] {
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: true, style: true, noscript: true },
  });
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string | null | undefined) => {
    const abs = absUrl(base, raw);
    if (!abs) return;
    const full = toFullWpUploadUrl(abs);
    if (seen.has(full)) return;
    seen.add(full);
    out.push(full);
  };

  for (const img of root.querySelectorAll("img")) {
    push(img.getAttribute("src"));
    push(img.getAttribute("data-src"));
    push(img.getAttribute("data-lazy-src"));
    push(img.getAttribute("data-full-url"));
    push(img.getAttribute("data-large_image"));
    push(img.getAttribute("data-src-full"));
    const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
    for (const part of srcset.split(",")) {
      push(part.trim().split(/\s+/)[0]);
    }
  }
  for (const el of root.querySelectorAll("[style*='background']")) {
    const style = el.getAttribute("style") || "";
    const bg = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/i.exec(style);
    if (bg) push(bg[1]);
  }
  // Elementor bg in data-settings
  for (const el of root.querySelectorAll("[data-settings]")) {
    const raw = el.getAttribute("data-settings") || "";
    const urls = raw.matchAll(/https?:\\?\/\\?\/[^"'\s]+\/wp-content\/uploads\/[^"'\s]+/gi);
    for (const m of urls) {
      push(m[0].replace(/\\\//g, "/"));
    }
  }

  return out.slice(0, 200);
}

function fieldLabel(input: HTMLElement): string | undefined {
  const id = input.getAttribute("id");
  const aria = input.getAttribute("aria-label");
  if (aria) return aria.slice(0, 80);
  // parent walk for label[for] is expensive; use placeholder as soft label fallback
  void id;
  const ph = input.getAttribute("placeholder");
  if (ph) return ph.slice(0, 80);
  return undefined;
}

function classifyForm(
  action: string,
  method: string,
  fields: DesignFormField[],
  id: string | null,
  classes: string[],
  htmlSnippet: string,
): { category: FormCategory; confidence: "high" | "medium" | "low"; evidence: string } {
  const blob = `${action} ${id || ""} ${classes.join(" ")} ${htmlSnippet} ${fields.map((f) => f.name).join(" ")}`.toLowerCase();
  const names = fields.map((f) => f.name.toLowerCase());
  const types = fields.map((f) => f.type.toLowerCase());

  if (
    /lost.?password|forgot.?password|retrieve_password|rp_key|resetpass/i.test(blob) ||
    names.some((n) => /lost|forgot|reset.?pass|user_login/.test(n) && /pass|mail/.test(blob))
  ) {
    if (/lost|forgot|reset|retrieve/i.test(blob)) {
      return { category: "lost_password", confidence: "high", evidence: "lost/reset password markers" };
    }
  }
  if (
    /wp-login\.php|action=login|log\b|user_login|woocommerce-form-login|login-form|signin/i.test(
      blob,
    ) ||
    (names.includes("log") || names.includes("pwd") || names.includes("password")) &&
      (names.includes("log") || names.includes("username") || names.includes("user_login") || names.includes("email"))
  ) {
    if (/register|signup|woocommerce-form-register/i.test(blob)) {
      return { category: "register", confidence: "high", evidence: "register form markers" };
    }
    if (/lost|forgot|reset/i.test(blob)) {
      return { category: "lost_password", confidence: "high", evidence: "password recovery" };
    }
    return { category: "login", confidence: "high", evidence: "login / wp-login markers" };
  }
  if (/register|signup|create.?account|woocommerce-form-register/i.test(blob)) {
    return { category: "register", confidence: "high", evidence: "registration markers" };
  }
  if (
    /book|reservation|appointment|calendly|booking/i.test(blob) ||
    names.some((n) => /date|time|guest|party|appointment|booking/.test(n))
  ) {
    return { category: "booking", confidence: "medium", evidence: "booking/date fields" };
  }
  if (
    /contact|wpcf7|elementor-form|wpforms|fluentform|ninja.forms|gravity/i.test(blob) ||
    (types.includes("email") && names.some((n) => /message|your-message|comment|body/.test(n)))
  ) {
    return { category: "contact", confidence: "high", evidence: "contact form markers" };
  }
  if (/newsletter|mailchimp|subscribe|mc4wp/i.test(blob)) {
    return { category: "newsletter", confidence: "high", evidence: "newsletter markers" };
  }
  if (/checkout|cart|woocommerce-checkout|payment/i.test(blob)) {
    return { category: "checkout", confidence: "high", evidence: "checkout markers" };
  }
  if (/search|s=/i.test(blob) && fields.length <= 3 && names.some((n) => n === "s" || n === "q")) {
    return { category: "search", confidence: "high", evidence: "search form" };
  }
  if (types.includes("password") || names.some((n) => /pass|pwd|auth|token|otp/.test(n))) {
    return { category: "auth", confidence: "medium", evidence: "password/auth fields" };
  }
  return { category: "other", confidence: "low", evidence: `${method} form` };
}

export function extractDesignForms(html: string, base: string): DesignForm[] {
  const root = parse(html, {
    comment: false,
    blockTextElements: { script: true, style: true, noscript: true },
  });
  const forms: DesignForm[] = [];

  for (const form of root.querySelectorAll("form")) {
    const action = absUrl(base, form.getAttribute("action")) || base;
    const method = (form.getAttribute("method") || "get").toUpperCase();
    const id = form.getAttribute("id") || null;
    const classes = (form.getAttribute("class") || "").split(/\s+/).filter(Boolean).slice(0, 12);
    const fields: DesignFormField[] = [];

    for (const input of form.querySelectorAll("input, select, textarea")) {
      const name = input.getAttribute("name") || "";
      const typeAttr =
        input.getAttribute("type") ||
        (input.tagName.toLowerCase() === "textarea"
          ? "textarea"
          : input.tagName.toLowerCase() === "select"
            ? "select"
            : "text");
      if (typeAttr === "hidden" && !/nonce|action|redirect|form_id|_wp/i.test(name)) {
        // keep WP hidden control fields that matter
        if (!name) continue;
      }
      if (!name && typeAttr !== "submit") continue;
      if (typeAttr === "submit" || typeAttr === "button" || typeAttr === "image") continue;

      fields.push({
        name: name || `(unnamed-${typeAttr})`,
        type: typeAttr,
        required:
          input.hasAttribute("required") ||
          input.getAttribute("aria-required") === "true",
        placeholder: input.getAttribute("placeholder") || undefined,
        label: fieldLabel(input),
        autocomplete: input.getAttribute("autocomplete") || undefined,
      });
      if (fields.length >= 40) break;
    }

    let submitText: string | null = null;
    const submitBtn = form.querySelector(
      'button[type="submit"], input[type="submit"], button:not([type])',
    );
    if (submitBtn) {
      submitText =
        (submitBtn.getAttribute("value") || submitBtn.text || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 80) || null;
    }

    const snippet = (form.getAttribute("class") || "") + (form.innerHTML || "").slice(0, 400);
    const { category, confidence, evidence } = classifyForm(
      action,
      method,
      fields,
      id,
      classes,
      snippet,
    );

    forms.push({
      action,
      method,
      category,
      id,
      classes,
      fields,
      submitText,
      confidence,
      evidence,
    });
    if (forms.length >= 30) break;
  }

  // Prefer interactive categories first in list
  const rank: Record<FormCategory, number> = {
    login: 0,
    register: 1,
    lost_password: 2,
    auth: 3,
    contact: 4,
    booking: 5,
    checkout: 6,
    newsletter: 7,
    search: 8,
    other: 9,
  };
  forms.sort((a, b) => rank[a.category] - rank[b.category]);
  return forms;
}

export function extractDesignSystem(
  html: string,
  base: string,
  cssBundles: string[] = [],
): DesignSystemExtract {
  const notes: string[] = [];
  const elementor = extractElementorGlobals(html, cssBundles);
  const typography = extractTypographyTokens(html, cssBundles, elementor);
  const fullImageUrls = extractFullImageUrls(html, base);
  const forms = extractDesignForms(html, base);

  if (Object.keys(elementor.colors).length) {
    notes.push(
      `Elementor global colors: ${Object.keys(elementor.colors).length} (--e-global-color-*).`,
    );
  }
  if (Object.keys(elementor.typography).length) {
    notes.push(
      `Elementor global typography vars: ${Object.keys(elementor.typography).length}.`,
    );
  }
  const typed = typography.filter(
    (t) => t.fontFamily || t.fontSize || t.fontWeight || t.lineHeight,
  );
  if (typed.length) {
    notes.push(`Typography tokens filled for: ${typed.map((t) => t.selector).join(", ")}.`);
  }
  if (fullImageUrls.length) {
    notes.push(`Full-size image candidates (WP suffix stripped): ${fullImageUrls.length}.`);
  }
  const interactive = forms.filter((f) =>
    ["login", "register", "lost_password", "contact", "booking", "auth"].includes(
      f.category,
    ),
  );
  if (interactive.length) {
    notes.push(
      `Interactive forms: ${interactive.map((f) => f.category).join(", ")}.`,
    );
  }

  return { elementor, typography, fullImageUrls, forms, notes };
}
