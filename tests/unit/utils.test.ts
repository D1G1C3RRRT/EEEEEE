import { describe, expect, it } from "vitest";
import { cn, formatBytes, shortId } from "@/lib/utils";

describe("utils · cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toContain("px-2");
    expect(cn("px-2", "py-1")).toContain("py-1");
  });

  it("resolves tailwind conflicts via twMerge", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("ignores falsy values", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });
});

describe("utils · formatBytes", () => {
  it("formats bytes / KB / MB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.00 MB");
  });

  it("handles invalid input", () => {
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("utils · shortId", () => {
  it("strips BLUEPRINT_ prefix and truncates", () => {
    expect(shortId("BLUEPRINT_sample_example_20260730_ABCD")).toBe(
      "sample_example_202",
    );
  });

  it("works without prefix", () => {
    expect(shortId("plain_id_value_long_enough")).toBe("plain_id_value_lon");
  });
});
