import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { compareBlueprints } from "./compare";
import {
  deleteBlueprintDb,
  listBlueprintsDb,
  loadBlueprintDb,
  saveBlueprintDb,
} from "./db-store";
import { scanToBlueprint } from "./scan";
import type { Blueprint } from "./types";
import {
  installProcessErrorGuards,
  withApiGuard,
  toApiError,
} from "@/lib/scanner/errors";

installProcessErrorGuards();

const memory = new Map<string, Blueprint>();

const scanSchema = z
  .object({
    url: z.string().optional(),
    html: z.string().optional(),
    baseUrl: z.string().optional(),
    maxPages: z.number().int().min(1).max(20).optional(),
    render: z.boolean().optional(),
    wayback: z.boolean().optional(),
    captureAssets: z.boolean().optional(),
    wpJetEngine: z.boolean().optional(),
  })
  .refine((d) => Boolean(d.url?.trim() || d.html?.trim()), {
    message: "Zadaj URL alebo HTML",
  });

export const scanBlueprint = createServerFn({ method: "POST" })
  .validator((data: unknown) => scanSchema.parse(data))
  .handler(async (ctx) => {
    const data = ctx.data;
    const signal =
      "signal" in ctx && ctx.signal instanceof AbortSignal
        ? ctx.signal
        : undefined;
    return withApiGuard(async () => {
      try {
        const blueprint = await scanToBlueprint({
          url: data.url,
          html: data.html,
          baseUrl: data.baseUrl,
          maxPages: data.maxPages,
          render: data.render,
          wayback: data.wayback,
          captureAssets: data.captureAssets,
          wpJetEngine: data.wpJetEngine,
          signal,
        });
        if (signal?.aborted) {
          return { ok: false as const, error: "Sken bol zrušený.", code: "ABORTED" };
        }
        memory.set(blueprint.id, blueprint);
        if (memory.size > 40) {
          const first = memory.keys().next().value;
          if (first) memory.delete(first);
        }
        try {
          await saveBlueprintDb(blueprint);
        } catch (err) {
          console.warn("[blueprint] DB save failed:", err);
        }
        return { ok: true as const, blueprint };
      } catch (err) {
        if (
          signal?.aborted ||
          (err instanceof Error &&
            (err.name === "AbortError" || /abort/i.test(err.message)))
        ) {
          return { ok: false as const, error: "Sken bol zrušený.", code: "ABORTED" };
        }
        return toApiError(err, "Sken zlyhal z neznámeho dôvodu.");
      }
    });
  });

export const getBlueprint = createServerFn({ method: "GET" })
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    try {
      let bp = memory.get(data.id) ?? null;
      if (!bp) {
        try {
          bp = await loadBlueprintDb(data.id);
        } catch {
          bp = null;
        }
      }
      return { blueprint: bp };
    } catch (err) {
      console.error("[getBlueprint]", err);
      return { blueprint: null };
    }
  });

export const listBlueprints = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const items = await listBlueprintsDb(40);
      return {
        items: items.map((b) => ({
          id: b.id,
          title: b.title,
          sourceUrl: b.sourceUrl,
          createdAt: b.createdAt,
          tech: [] as string[],
          contentHash: b.contentHash,
        })),
      };
    } catch {
      const items = [...memory.values()]
        .map((b) => ({
          id: b.id,
          title: b.meta.title || b.sourceUrl || "Bez názvu",
          sourceUrl: b.sourceUrl,
          createdAt: b.createdAt,
          tech: b.tech.map((t) => t.name),
          contentHash: b.contentHash,
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return { items };
    }
  },
);

export const deleteBlueprint = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    memory.delete(data.id);
    try {
      await deleteBlueprintDb(data.id);
    } catch {
      /* ignore */
    }
    return { ok: true as const };
  });

export const compareBlueprintPair = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        leftId: z.string().min(1),
        rightId: z.string().min(1),
        left: z.any().optional(),
        right: z.any().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    let left =
      (data.left as Blueprint | undefined) ||
      memory.get(data.leftId) ||
      (await loadBlueprintDb(data.leftId).catch(() => null));
    let right =
      (data.right as Blueprint | undefined) ||
      memory.get(data.rightId) ||
      (await loadBlueprintDb(data.rightId).catch(() => null));
    if (!left || !right) {
      return {
        ok: false as const,
        error: "Jeden alebo oba blueprinty sa nenašli. Otvor ich z histórie alebo importuj JSON.",
      };
    }
    return { ok: true as const, result: compareBlueprints(left, right) };
  });
