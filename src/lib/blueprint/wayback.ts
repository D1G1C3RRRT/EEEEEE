/**
 * Wayback Machine helpers — recover public pages when live URL fails.
 */

export type WaybackHit = {
  url: string;
  timestamp: string;
  status: string;
};

export async function findWaybackSnapshot(
  originalUrl: string,
): Promise<WaybackHit | null> {
  const api = `https://archive.org/wayback/available?url=${encodeURIComponent(originalUrl)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(api, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      archived_snapshots?: {
        closest?: { available?: boolean; url?: string; timestamp?: string; status?: string };
      };
    };
    const closest = data.archived_snapshots?.closest;
    if (!closest?.available || !closest.url || !closest.timestamp) return null;

    // id_ mode returns original document without Wayback toolbar chrome
    const rawUrl = `https://web.archive.org/web/${closest.timestamp}id_/${originalUrl}`;
    return {
      url: rawUrl,
      timestamp: closest.timestamp,
      status: closest.status || "200",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
