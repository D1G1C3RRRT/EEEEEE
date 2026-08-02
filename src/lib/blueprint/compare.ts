import type { Blueprint, BlueprintCompareResult, CompareChange } from "./types";

function setDiff(a: string[], b: string[]): { added: string[]; removed: string[] } {
  const A = new Set(a);
  const B = new Set(b);
  return {
    added: [...B].filter((x) => !A.has(x)),
    removed: [...A].filter((x) => !B.has(x)),
  };
}

export function compareBlueprints(
  left: Blueprint,
  right: Blueprint,
): BlueprintCompareResult {
  const changes: CompareChange[] = [];

  if (left.meta.title !== right.meta.title) {
    changes.push({
      path: "meta.title",
      kind: "changed",
      left: left.meta.title,
      right: right.meta.title,
    });
  }
  if (left.meta.description !== right.meta.description) {
    changes.push({
      path: "meta.description",
      kind: "changed",
      left: left.meta.description.slice(0, 120),
      right: right.meta.description.slice(0, 120),
    });
  }
  if (left.contentHash !== right.contentHash) {
    changes.push({
      path: "contentHash",
      kind: "changed",
      left: left.contentHash,
      right: right.contentHash,
    });
  }

  const leftTech = left.tech.map((t) => t.name).sort();
  const rightTech = right.tech.map((t) => t.name).sort();
  const tech = setDiff(leftTech, rightTech);
  for (const name of tech.added) {
    changes.push({ path: `tech.${name}`, kind: "added", right: name });
  }
  for (const name of tech.removed) {
    changes.push({ path: `tech.${name}`, kind: "removed", left: name });
  }

  const leftLinks = new Set(left.links.map((l) => l.href));
  const rightLinks = new Set(right.links.map((l) => l.href));
  for (const href of rightLinks) {
    if (!leftLinks.has(href)) {
      changes.push({ path: "links", kind: "added", right: href });
    }
  }
  for (const href of leftLinks) {
    if (!rightLinks.has(href)) {
      changes.push({ path: "links", kind: "removed", left: href });
    }
  }

  const leftAssets = new Set(left.assets.map((a) => a.url));
  const rightAssets = new Set(right.assets.map((a) => a.url));
  let assetAdded = 0;
  let assetRemoved = 0;
  for (const u of rightAssets) {
    if (!leftAssets.has(u)) {
      assetAdded += 1;
      if (changes.length < 80) {
        changes.push({ path: "assets", kind: "added", right: u });
      }
    }
  }
  for (const u of leftAssets) {
    if (!rightAssets.has(u)) {
      assetRemoved += 1;
      if (changes.length < 80) {
        changes.push({ path: "assets", kind: "removed", left: u });
      }
    }
  }

  const leftFonts = new Set(left.design.fonts);
  const rightFonts = new Set(right.design.fonts);
  for (const f of rightFonts) {
    if (!leftFonts.has(f)) changes.push({ path: "design.fonts", kind: "added", right: f });
  }
  for (const f of leftFonts) {
    if (!rightFonts.has(f)) changes.push({ path: "design.fonts", kind: "removed", left: f });
  }

  const leftPages = left.pages?.length ?? 0;
  const rightPages = right.pages?.length ?? 0;
  if (leftPages !== rightPages) {
    changes.push({
      path: "pages.count",
      kind: "changed",
      left: String(leftPages),
      right: String(rightPages),
    });
  }

  const leftColors = left.design.colors.slice(0, 20).join(",");
  const rightColors = right.design.colors.slice(0, 20).join(",");
  if (leftColors !== rightColors) {
    changes.push({
      path: "design.colors",
      kind: "changed",
      left: `${left.design.colors.length} colors`,
      right: `${right.design.colors.length} colors`,
    });
  }

  return {
    leftId: left.id,
    rightId: right.id,
    identical: changes.length === 0 && left.contentHash === right.contentHash,
    summary: {
      titleChanged: left.meta.title !== right.meta.title,
      hashChanged: left.contentHash !== right.contentHash,
      techAdded: tech.added,
      techRemoved: tech.removed,
      assetCountDelta: right.assets.length - left.assets.length,
      linkCountDelta: right.links.length - left.links.length,
      pageCountDelta: rightPages - leftPages,
    },
    changes: changes.slice(0, 100),
  };
}
