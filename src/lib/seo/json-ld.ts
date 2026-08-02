/**
 * Schema.org JSON-LD builders for Blueprint Scanner.
 * Output is safe to inject as <script type="application/ld+json">.
 */

export type JsonLdNode = Record<string, unknown>;

export type JsonLdGraph = {
  "@context": "https://schema.org";
  "@graph": JsonLdNode[];
};

export const SITE_NAME = "Blueprint";
export const SITE_TITLE = "Blueprint — URL → 1:1 frontend blueprint";
export const SITE_DESCRIPTION =
  "Skenuj ľubovoľnú verejnú URL alebo vlož HTML a vytvor štruktúrovaný 1:1 frontend blueprint s exportom JSON/ZIP. WordPress, JetEngine, Elementor reverse-spec.";

export type JsonLdSiteOptions = {
  /** Absolute origin e.g. https://blueprint.example.com — optional for local/dev */
  origin?: string | null;
  /** App path (default "/") */
  path?: string;
  locale?: string;
};

function abs(origin: string | null | undefined, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!origin) return p;
  return `${origin.replace(/\/$/, "")}${p}`;
}

/** Primary site graph: WebSite + WebApplication + SoftwareApplication + Organization */
export function buildSiteJsonLd(opts: JsonLdSiteOptions = {}): JsonLdGraph {
  const origin = opts.origin?.trim() || null;
  const path = opts.path ?? "/";
  const pageUrl = abs(origin, path);
  const logoUrl = abs(origin, "/android-chrome-512x512.png");
  const locale = opts.locale ?? "sk-SK";

  const orgId = origin ? `${origin.replace(/\/$/, "")}/#organization` : "#organization";
  const websiteId = origin ? `${origin.replace(/\/$/, "")}/#website` : "#website";
  const appId = origin ? `${origin.replace(/\/$/, "")}/#app` : "#app";

  const organization: JsonLdNode = {
    "@type": "Organization",
    "@id": orgId,
    name: SITE_NAME,
    url: origin || pageUrl,
    logo: {
      "@type": "ImageObject",
      url: logoUrl,
      width: 512,
      height: 512,
    },
  };

  const website: JsonLdNode = {
    "@type": "WebSite",
    "@id": websiteId,
    name: SITE_NAME,
    url: pageUrl,
    description: SITE_DESCRIPTION,
    inLanguage: locale,
    publisher: { "@id": orgId },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: pageUrl,
      },
      "query-input": "required name=url",
    },
  };

  const webApp: JsonLdNode = {
    "@type": ["WebApplication", "SoftwareApplication"],
    "@id": appId,
    name: "Blueprint Scanner",
    alternateName: SITE_NAME,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "WebDevelopmentTool",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript. Modern evergreen browser.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
    description: SITE_DESCRIPTION,
    url: pageUrl,
    image: logoUrl,
    inLanguage: [locale, "en-US"],
    featureList: [
      "Public URL frontend snapshot",
      "Multi-page same-origin crawl with partial recovery",
      "WordPress / JetEngine / Elementor architecture extract",
      "Elementor template JSON export",
      "Design tokens and form classification",
      "JSON and ZIP blueprint export",
    ],
    screenshot: logoUrl,
    author: { "@id": orgId },
    publisher: { "@id": orgId },
    isAccessibleForFree: true,
    softwareVersion: "1.2.0",
  };

  const webPage: JsonLdNode = {
    "@type": "WebPage",
    "@id": `${pageUrl === "/" ? "#webpage" : `${pageUrl}#webpage`}`,
    url: pageUrl,
    name: SITE_TITLE,
    description: SITE_DESCRIPTION,
    isPartOf: { "@id": websiteId },
    about: { "@id": appId },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: logoUrl,
    },
    inLanguage: locale,
  };

  return {
    "@context": "https://schema.org",
    "@graph": [organization, website, webApp, webPage],
  };
}

/** FAQ structured data for common product questions */
export function buildFaqJsonLd(opts: JsonLdSiteOptions = {}): JsonLdGraph {
  const origin = opts.origin?.trim() || null;
  const pageUrl = abs(origin, opts.path ?? "/");

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "@id": origin ? `${origin.replace(/\/$/, "")}/#faq` : "#faq",
        url: pageUrl,
        mainEntity: [
          {
            "@type": "Question",
            name: "Čo je Blueprint Scanner?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Nástroj na reverse-spec verejného frontendu z URL alebo HTML: crawl, design tokeny, WordPress/JetEngine/Elementor extract a export JSON/ZIP.",
            },
          },
          {
            "@type": "Question",
            name: "Klonuje Blueprint aj backend a databázu?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Nie. Blueprint je frontend snapshot z verejne dostupného HTML/CSS/JS a voliteľných verejných REST endpointov. Nesťahuje .env, heslá ani privátne postmeta.",
            },
          },
          {
            "@type": "Question",
            name: "Ako exportujem Elementor šablónu?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Po skene stiahni elementor-template-import.json a importuj ju vo WordPresse cez Templates → Saved Templates → Import.",
            },
          },
        ],
      },
    ],
  };
}

/** Serialize JSON-LD safely for inline script (escape </script>) */
export function serializeJsonLd(data: JsonLdGraph | JsonLdNode): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Combined scripts payload for TanStack head `scripts` array */
export function buildHeadJsonLdScripts(opts: JsonLdSiteOptions = {}): Array<{
  type: string;
  children: string;
}> {
  return [
    {
      type: "application/ld+json",
      children: serializeJsonLd(buildSiteJsonLd(opts)),
    },
    {
      type: "application/ld+json",
      children: serializeJsonLd(buildFaqJsonLd(opts)),
    },
  ];
}
