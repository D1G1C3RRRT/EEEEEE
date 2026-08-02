import type { TechSignal } from "./types";

const SIGNALS: Array<{
  name: string;
  confidence: TechSignal["confidence"];
  test: (ctx: DetectCtx) => string | null;
}> = [
  {
    name: "WordPress",
    confidence: "high",
    test: ({ html, headers }) => {
      if (/wp-content|wp-includes|wordpress/i.test(html)) return "wp-* paths in HTML";
      if (headers["x-powered-by"]?.toLowerCase().includes("wordpress")) return "X-Powered-By";
      if (headers["link"]?.includes("wp-json")) return "Link: api.w.org";
      return null;
    },
  },
  {
    name: "Elementor",
    confidence: "high",
    test: ({ html }) =>
      /elementor-widget|data-elementor-type|elementor-section/i.test(html)
        ? "Elementor DOM markers"
        : null,
  },
  {
    name: "JetEngine",
    confidence: "high",
    test: ({ html }) =>
      /jet-listing-grid|jet-engine|jet-cct|jet-smart-filters/i.test(html)
        ? "JetEngine listing / CCT markers"
        : null,
  },
  {
    name: "WooCommerce",
    confidence: "high",
    test: ({ html }) =>
      /woocommerce|wc-block|wp-json\/wc\//i.test(html) ? "WooCommerce markers" : null,
  },
  {
    name: "React",
    confidence: "high",
    test: ({ html }) => {
      if (/data-reactroot|__NEXT_DATA__|__react/i.test(html)) return "React markers";
      if (/react(-dom)?(\.min)?\.js|react@/i.test(html)) return "React script";
      return null;
    },
  },
  {
    name: "Next.js",
    confidence: "high",
    test: ({ html, headers }) => {
      if (/__NEXT_DATA__|_next\/static/i.test(html)) return "__NEXT_DATA__ / _next";
      if (headers["x-powered-by"]?.toLowerCase().includes("next.js")) return "X-Powered-By: Next.js";
      return null;
    },
  },
  {
    name: "Vue.js",
    confidence: "high",
    test: ({ html }) =>
      /data-v-[a-f0-9]|__VUE__|vue(\.runtime)?(\.min)?\.js/i.test(html)
        ? "Vue markers"
        : null,
  },
  {
    name: "Nuxt",
    confidence: "high",
    test: ({ html }) =>
      /__NUXT__|_nuxt\//i.test(html) ? "Nuxt markers" : null,
  },
  {
    name: "Angular",
    confidence: "high",
    test: ({ html }) =>
      /ng-version=|ng-app|_ngcontent/i.test(html) ? "Angular markers" : null,
  },
  {
    name: "Svelte",
    confidence: "medium",
    test: ({ html }) =>
      /svelte-|__svelte/i.test(html) ? "Svelte markers" : null,
  },
  {
    name: "Vite",
    confidence: "medium",
    test: ({ html }) =>
      /@vite\/client|vite\/modulepreload|data-vite/i.test(html) ? "Vite markers" : null,
  },
  {
    name: "Tailwind CSS",
    confidence: "medium",
    test: ({ html, css }) => {
      if (/\b(flex|grid|text-\w+|bg-\w+|md:|sm:|lg:|xl:|2xl:)\b/.test(html) &&
          /class=["'][^"']{40,}/.test(html))
        return "utility-class pattern";
      if (/--tw-|@tailwind|tailwindcss/i.test(css)) return "Tailwind CSS vars";
      return null;
    },
  },
  {
    name: "Bootstrap",
    confidence: "high",
    test: ({ html, css }) => {
      if (/bootstrap(\.min)?\.css|data-bs-/i.test(html)) return "Bootstrap assets";
      if (/\.container-fluid|btn-primary|--bs-/i.test(css)) return "Bootstrap CSS";
      return null;
    },
  },
  {
    name: "jQuery",
    confidence: "high",
    test: ({ html }) =>
      /jquery(-|\.)?(min\.)?js|jQuery/i.test(html) ? "jQuery script" : null,
  },
  {
    name: "Shopify",
    confidence: "high",
    test: ({ html, headers }) => {
      if (/cdn\.shopify\.com|Shopify\.theme/i.test(html)) return "Shopify CDN";
      if (headers["x-shopid"] || headers["x-shopify-stage"]) return "Shopify headers";
      return null;
    },
  },
  {
    name: "Webflow",
    confidence: "high",
    test: ({ html }) =>
      /w-webflow|webflow\.js|data-wf-/i.test(html) ? "Webflow markers" : null,
  },
  {
    name: "Framer",
    confidence: "high",
    test: ({ html }) =>
      /framer\.com|data-framer/i.test(html) ? "Framer markers" : null,
  },
  {
    name: "PWA",
    confidence: "high",
    test: ({ html }) =>
      /rel=["']manifest["']|serviceWorker|workbox/i.test(html)
        ? "manifest / service worker"
        : null,
  },
  {
    name: "Google Analytics",
    confidence: "high",
    test: ({ html }) =>
      /gtag\/js|google-analytics\.com|G-[A-Z0-9]+|UA-\d+/i.test(html)
        ? "GA scripts"
        : null,
  },
  {
    name: "Google Tag Manager",
    confidence: "high",
    test: ({ html }) =>
      /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i.test(html) ? "GTM" : null,
  },
  {
    name: "Laravel",
    confidence: "medium",
    test: ({ html, headers }) => {
      if (/laravel_session|XSRF-TOKEN/i.test(headers["set-cookie"] ?? ""))
        return "Laravel cookies";
      if (/csrf-token|laravel/i.test(html)) return "Laravel CSRF / markers";
      return null;
    },
  },
  {
    name: "Django",
    confidence: "medium",
    test: ({ html, headers }) => {
      if (/csrftoken|django/i.test(headers["set-cookie"] ?? "")) return "Django cookies";
      if (/csrfmiddlewaretoken/i.test(html)) return "Django CSRF field";
      return null;
    },
  },
  {
    name: "Cloudflare",
    confidence: "high",
    test: ({ headers }) =>
      headers["cf-ray"] || headers["server"]?.toLowerCase().includes("cloudflare")
        ? "Cloudflare headers"
        : null,
  },
  {
    name: "Vercel",
    confidence: "high",
    test: ({ headers }) =>
      headers["x-vercel-id"] || headers["server"]?.toLowerCase() === "vercel"
        ? "Vercel headers"
        : null,
  },
  {
    name: "Netlify",
    confidence: "high",
    test: ({ headers }) =>
      headers["x-nf-request-id"] || headers["server"]?.toLowerCase().includes("netlify")
        ? "Netlify headers"
        : null,
  },
];

export interface DetectCtx {
  html: string;
  css: string;
  headers: Record<string, string>;
  scripts: string[];
}

export function detectTech(ctx: DetectCtx): TechSignal[] {
  const out: TechSignal[] = [];
  for (const s of SIGNALS) {
    const evidence = s.test(ctx);
    if (evidence) {
      out.push({ name: s.name, confidence: s.confidence, evidence });
    }
  }
  return out;
}
