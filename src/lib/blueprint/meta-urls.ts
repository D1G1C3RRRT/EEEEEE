/**
 * Resolve relative Open Graph / Twitter meta URLs against the scanned page origin.
 */
export function absolutizeUrl(value: string, base: string): string {
  const v = value.trim();
  if (!v) return v;
  if (
    /^(https?:|data:|blob:|\/\/)/i.test(v) ||
    v.startsWith("about:") ||
    v.startsWith("javascript:")
  ) {
    if (v.startsWith("//")) {
      try {
        const proto = new URL(base).protocol || "https:";
        return `${proto}${v}`;
      } catch {
        return `https:${v}`;
      }
    }
    return v;
  }
  try {
    return new URL(v, base).href;
  } catch {
    return v;
  }
}

const OG_URL_KEYS = new Set([
  "og:url",
  "og:image",
  "og:image:url",
  "og:image:secure_url",
  "og:audio",
  "og:video",
  "og:video:url",
  "og:video:secure_url",
]);

const TWITTER_URL_KEYS = new Set([
  "twitter:image",
  "twitter:image:src",
  "twitter:player",
  "twitter:url",
]);

export function absolutizeOpenGraphMeta(
  og: Record<string, string>,
  base: string,
): Record<string, string> {
  const out: Record<string, string> = { ...og };
  for (const [key, val] of Object.entries(out)) {
    if (!val) continue;
    if (OG_URL_KEYS.has(key) || key.endsWith(":url") || key.includes("image")) {
      // only rewrite known URL-ish keys + any *image*
      if (OG_URL_KEYS.has(key) || /image/i.test(key)) {
        out[key] = absolutizeUrl(val, base);
      }
    }
  }
  // Ensure og:url defaults to page base when missing
  if (!out["og:url"] && base) {
    try {
      out["og:url"] = new URL(base).href;
    } catch {
      /* ignore */
    }
  } else if (out["og:url"]) {
    out["og:url"] = absolutizeUrl(out["og:url"], base);
  }
  return out;
}

export function absolutizeTwitterMeta(
  twitter: Record<string, string>,
  base: string,
): Record<string, string> {
  const out: Record<string, string> = { ...twitter };
  for (const [key, val] of Object.entries(out)) {
    if (!val) continue;
    if (TWITTER_URL_KEYS.has(key) || /image/i.test(key)) {
      out[key] = absolutizeUrl(val, base);
    }
  }
  return out;
}
