export type ScanSource = "url" | "html" | "wayback";

export interface BlueprintMeta {
  title: string;
  description: string;
  canonical: string | null;
  language: string | null;
  robots: string | null;
  og: Record<string, string>;
  twitter: Record<string, string>;
  icons: string[];
  themeColor: string | null;
  viewport: string | null;
}

export interface BlueprintAsset {
  url: string;
  type: "image" | "script" | "stylesheet" | "font" | "icon" | "other";
  contentType?: string;
  size?: number;
  inline?: boolean;
  /** relative path inside ZIP when captured */
  path?: string;
  /** base64 payload when asset was downloaded */
  base64?: string;
  captured?: boolean;
}

export interface DesignTokens {
  colors: string[];
  fonts: string[];
  cssVariables: Record<string, string>;
  borderRadii: string[];
  shadows: string[];
  spacingHints: string[];
}

export interface DomOutlineNode {
  tag: string;
  id?: string;
  classes?: string[];
  role?: string;
  text?: string;
  children?: DomOutlineNode[];
}

export interface TechSignal {
  name: string;
  confidence: "high" | "medium" | "low";
  evidence: string;
}

export interface BlueprintLink {
  href: string;
  text: string;
  internal: boolean;
}

export interface BlueprintForm {
  action: string;
  method: string;
  fields: Array<{ name: string; type: string; required: boolean }>;
}

export interface BlueprintPage {
  url: string;
  title: string;
  contentHash: string;
  statusCode: number | null;
  htmlBytes: number;
  headings: Array<{ level: number; text: string }>;
  internalLinkCount: number;
  formCount: number;
}

export interface ScanOptionsApplied {
  maxPages: number;
  render: boolean;
  wayback: boolean;
  captureAssets: boolean;
}

export interface Blueprint {
  id: string;
  version: "1.0.0" | "1.1.0";
  createdAt: string;
  source: ScanSource;
  sourceUrl: string | null;
  finalUrl: string | null;
  statusCode: number | null;
  contentHash: string;
  contentType: string | null;
  headers: Record<string, string>;
  meta: BlueprintMeta;
  tech: TechSignal[];
  design: DesignTokens;
  assets: BlueprintAsset[];
  links: BlueprintLink[];
  forms: BlueprintForm[];
  scripts: string[];
  stylesheets: string[];
  outline: DomOutlineNode[];
  headings: Array<{ level: number; text: string }>;
  html: string;
  cssBundles: Array<{ url: string; css: string }>;
  /** additional same-origin pages from crawl (excludes primary) */
  pages: BlueprintPage[];
  options: ScanOptionsApplied;
  waybackUrl: string | null;
  rendered: boolean;
  stats: {
    htmlBytes: number;
    assetCount: number;
    capturedAssetCount: number;
    pageCount: number;
    internalLinkCount: number;
    externalLinkCount: number;
    formCount: number;
    scriptCount: number;
    stylesheetCount: number;
    scanMs: number;
  };
  notes: string[];
  limitations: string[];
}

export interface ScanRequest {
  url?: string;
  html?: string;
  baseUrl?: string;
  /** same-origin crawl size, 1–20 (default 1) */
  maxPages?: number;
  /** Playwright rendered DOM (default true for URL scans) */
  render?: boolean;
  /** archive.org fallback if live URL fails (default true) */
  wayback?: boolean;
  /** download binary assets into blueprint (default true) */
  captureAssets?: boolean;
}

export interface CompareChange {
  path: string;
  kind: "added" | "removed" | "changed";
  left?: string;
  right?: string;
}

export interface BlueprintCompareResult {
  leftId: string;
  rightId: string;
  identical: boolean;
  summary: {
    titleChanged: boolean;
    hashChanged: boolean;
    techAdded: string[];
    techRemoved: string[];
    assetCountDelta: number;
    linkCountDelta: number;
    pageCountDelta: number;
  };
  changes: CompareChange[];
}

export interface ScanResponse {
  ok: true;
  blueprint: Blueprint;
}

export interface ScanError {
  ok: false;
  error: string;
  code?: string;
}
