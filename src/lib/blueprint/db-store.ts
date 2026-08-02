import { getSql } from "@/lib/db";
import type { Blueprint } from "./types";

export type DbBlueprintSummary = {
  id: string;
  title: string;
  sourceUrl: string | null;
  contentHash: string;
  source: string;
  createdAt: string;
};

export async function saveBlueprintDb(bp: Blueprint): Promise<void> {
  const sql = await getSql();
  // strip heavy base64 for DB if payload huge — keep paths + metadata
  const slim: Blueprint = {
    ...bp,
    assets: bp.assets.map((a) =>
      a.base64 && (a.base64.length > 50_000)
        ? { ...a, base64: undefined, captured: a.captured }
        : a,
    ),
  };
  await sql`
    insert into blueprints (id, title, source_url, content_hash, source, created_at, payload)
    values (
      ${bp.id},
      ${bp.meta.title || bp.id},
      ${bp.sourceUrl},
      ${bp.contentHash},
      ${bp.source},
      ${bp.createdAt}::timestamptz,
      ${JSON.stringify(slim)}::jsonb
    )
    on conflict (id) do update set
      title = excluded.title,
      source_url = excluded.source_url,
      content_hash = excluded.content_hash,
      source = excluded.source,
      payload = excluded.payload
  `;
}

export async function listBlueprintsDb(limit = 30): Promise<DbBlueprintSummary[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    title: string;
    source_url: string | null;
    content_hash: string;
    source: string;
    created_at: string | Date;
  }>`
    select id, title, source_url, content_hash, source, created_at
    from blueprints
    order by created_at desc
    limit ${limit}
  `;
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    sourceUrl: r.source_url,
    contentHash: r.content_hash,
    source: r.source,
    createdAt:
      typeof r.created_at === "string"
        ? r.created_at
        : new Date(r.created_at).toISOString(),
  }));
}

export async function loadBlueprintDb(id: string): Promise<Blueprint | null> {
  const sql = await getSql();
  const rows = await sql<{ payload: Blueprint | string }>`
    select payload from blueprints where id = ${id} limit 1
  `;
  if (!rows[0]) return null;
  const p = rows[0].payload;
  return typeof p === "string" ? (JSON.parse(p) as Blueprint) : p;
}

export async function deleteBlueprintDb(id: string): Promise<void> {
  const sql = await getSql();
  await sql`delete from blueprints where id = ${id}`;
}
